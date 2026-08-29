import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId, getGoogleSheetsClient, SPREADSHEET_ID, invalidateSheet } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { resolvePresetId, DEFAULT_PRESET_ID } from '@/lib/target';
import { NextResponse } from 'next/server';

// GET /api/target-item?kelompok_id=...&tingkatan=...            -> semua kategori (buat Kartu Target)
// GET /api/target-item?kelompok_id=...&tingkatan=...&kategori=...  -> satu kategori (buat editor)
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  const tingkatan = searchParams.get('tingkatan');
  const kategori = searchParams.get('kategori');
  if (!kelompok_id) return NextResponse.json({ error: 'kelompok_id wajib diisi' }, { status: 400 });

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const kelompokList = await readSheet(SHEETS.KELOMPOK);
  const kelompok = kelompokList.find(k => k.id === kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const presetId = resolvePresetId(kelompok);
  const semuaItem = await readSheet(SHEETS.TARGET_ITEM);
  let hasil = semuaItem.filter(i => i.preset_id === presetId);
  if (tingkatan) hasil = hasil.filter(i => i.tingkatan === tingkatan);
  if (kategori) hasil = hasil.filter(i => i.kategori === kategori);
  hasil.sort((a, b) => Number(a.urutan) - Number(b.urutan));

  return NextResponse.json({ preset_id: presetId, items: hasil });
}

// POST { kelompok_id, tingkatan, kategori, items: [{ id?, nama_item }] }
// Kalau kelompok belum "punya" preset yang lagi diikuti (bukan pembuatnya),
// otomatis fork dulu (salin semua item) baru edit kategori yang diminta.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, tingkatan, kategori, items } = await req.json();

  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa mengelola target' }, { status: 403 });

  const kelompokList = await readSheet(SHEETS.KELOMPOK);
  const kelompok = kelompokList.find(k => k.id === kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [semuaPreset, semuaItem] = await Promise.all([
    readSheet(SHEETS.TARGET_PRESET),
    readSheet(SHEETS.TARGET_ITEM),
  ]);

  let presetId = resolvePresetId(kelompok);
  const presetSaatIni = semuaPreset.find(p => p.id === presetId);
  const milikSendiri = presetSaatIni?.dibuat_oleh_kelompok_id === kelompok_id;

  const sheets = getGoogleSheetsClient();
  let daftarItemAktif = semuaItem;

  if (!milikSendiri) {
    // Fork: bikin preset baru milik kelompok ini, salin semua item preset lama
    const newPresetId = generateId();
    await appendRow(SHEETS.TARGET_PRESET, [
      newPresetId, `Target ${kelompok.nama_kelompok}`, kelompok_id,
      kelompok.nama_kelompok, kelompok.desa, kelompok.daerah, session.user.email, new Date().toISOString(),
    ]);

    const itemLama = semuaItem.filter(i => i.preset_id === presetId);
    const itemBaru = itemLama.map(i => ({ ...i, id: generateId(), preset_id: newPresetId }));
    for (const item of itemBaru) {
      await appendRow(SHEETS.TARGET_ITEM, [item.id, item.preset_id, item.tingkatan, item.kategori, item.urutan, item.nama_item, new Date().toISOString()]);
    }

    // Alihkan kelompok ke preset baru
    const kHeaders = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];
    const kUpdated = kelompokList.map(k => k.id === kelompok_id ? { ...k, preset_id: newPresetId } : k);
    await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${SHEETS.KELOMPOK}!A:Z` });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.KELOMPOK}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [kHeaders, ...kUpdated.map(k => [k.id, k.user_id, k.nama_kelompok, k.tingkatan, k.desa, k.daerah, k.preset_id || '', k.created_at])] },
    });
    invalidateSheet(SHEETS.KELOMPOK);

    presetId = newPresetId;
    daftarItemAktif = [...semuaItem.filter(i => i.preset_id !== presetSaatIni?.id), ...itemBaru];
  }

  // Ganti isi kategori+tingkatan yang diminta di preset aktif, item lain dibiarkan
  const tetap = daftarItemAktif.filter(i => !(i.preset_id === presetId && i.tingkatan === tingkatan && i.kategori === kategori));
  const baru = (items || []).map((it, idx) => ({
    id: it.id || generateId(),
    preset_id: presetId,
    tingkatan, kategori,
    urutan: idx + 1,
    nama_item: it.nama_item,
    created_at: it.created_at || new Date().toISOString(),
  }));

  const iHeaders = ['id', 'preset_id', 'tingkatan', 'kategori', 'urutan', 'nama_item', 'created_at'];
  const semuaFinal = [...tetap, ...baru];
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${SHEETS.TARGET_ITEM}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.TARGET_ITEM}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [iHeaders, ...semuaFinal.map(i => [i.id, i.preset_id, i.tingkatan, i.kategori, i.urutan, i.nama_item, i.created_at])] },
  });
  invalidateSheet(SHEETS.TARGET_ITEM);

  return NextResponse.json({ success: true, preset_id: presetId, forked: !milikSendiri });
}
