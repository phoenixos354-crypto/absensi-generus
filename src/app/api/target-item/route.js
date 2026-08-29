import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, appendRows, updateRow, deleteRows, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { resolvePresetId, DEFAULT_PRESET_ID } from '@/lib/target';
import { NextResponse } from 'next/server';

const KELOMPOK_HEADERS = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];

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

  if (!milikSendiri) {
    // Fork: bikin preset baru milik kelompok ini, salin semua item preset lama
    // KECUALI kategori+tingkatan yang sedang diedit ini — item barunya nanti
    // langsung ditambah di bawah, jadi gak usah disalin dulu terus dihapus lagi.
    const newPresetId = generateId();
    await appendRow(SHEETS.TARGET_PRESET, [
      newPresetId, `Target ${kelompok.nama_kelompok}`, kelompok_id,
      kelompok.nama_kelompok, kelompok.desa, kelompok.daerah, session.user.email, new Date().toISOString(),
    ]);

    const itemLama = semuaItem.filter(i =>
      i.preset_id === presetId && !(i.tingkatan === tingkatan && i.kategori === kategori)
    );
    await appendRows(SHEETS.TARGET_ITEM, itemLama.map(item => [
      generateId(), newPresetId, item.tingkatan, item.kategori, item.urutan, item.nama_item, new Date().toISOString(),
    ]));

    // Alihkan kelompok ke preset baru — update 1 baris saja
    await updateRow(SHEETS.KELOMPOK, { ...kelompok, preset_id: newPresetId }, KELOMPOK_HEADERS);

    presetId = newPresetId;
  } else {
    // Preset ini milik kelompok sendiri — cukup hapus baris-baris LAMA di
    // kategori+tingkatan yang diedit ini saja, item kategori lain tidak disentuh.
    const itemLamaKategoriIni = semuaItem.filter(i =>
      i.preset_id === presetId && i.tingkatan === tingkatan && i.kategori === kategori
    );
    await deleteRows(SHEETS.TARGET_ITEM, itemLamaKategoriIni);
  }

  // Tambah baris-baris baru untuk kategori+tingkatan ini
  const baru = (items || []).map((it, idx) => [
    it.id || generateId(), presetId, tingkatan, kategori, idx + 1, it.nama_item, new Date().toISOString(),
  ]);
  await appendRows(SHEETS.TARGET_ITEM, baru);

  return NextResponse.json({ success: true, preset_id: presetId, forked: !milikSendiri });
}
