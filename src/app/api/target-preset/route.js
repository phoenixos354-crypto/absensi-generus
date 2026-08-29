import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId, getGoogleSheetsClient, SPREADSHEET_ID, invalidateSheet } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { getPresetTerlihat, DEFAULT_PRESET_ID } from '@/lib/target';
import { NextResponse } from 'next/server';

// GET /api/target-preset?kelompok_id=...  -> daftar preset yang bisa diikuti kelompok itu
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  if (!kelompok_id) return NextResponse.json({ error: 'kelompok_id wajib diisi' }, { status: 400 });

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const preset = await getPresetTerlihat(kelompok_id);
  return NextResponse.json(preset);
}

// POST { kelompok_id, nama_preset, source_preset_id }
// Bikin preset baru = salinan (fork) dari source_preset_id, lalu kelompok
// otomatis pindah mengikuti preset baru ini.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, nama_preset, source_preset_id } = await req.json();

  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa membuat preset target' }, { status: 403 });

  const kelompokList = await readSheet(SHEETS.KELOMPOK);
  const kelompok = kelompokList.find(k => k.id === kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 });

  const newPresetId = generateId();

  await appendRow(SHEETS.TARGET_PRESET, [
    newPresetId, nama_preset || `Target ${kelompok.nama_kelompok}`, kelompok_id,
    kelompok.nama_kelompok, kelompok.desa, kelompok.daerah, session.user.email, new Date().toISOString(),
  ]);

  // Duplikat semua item dari preset sumber ke preset baru (id baru semua)
  const semuaItem = await readSheet(SHEETS.TARGET_ITEM);
  const itemSumber = semuaItem.filter(i => i.preset_id === (source_preset_id || DEFAULT_PRESET_ID));
  for (const item of itemSumber) {
    await appendRow(SHEETS.TARGET_ITEM, [
      generateId(), newPresetId, item.tingkatan, item.kategori, item.urutan, item.nama_item, new Date().toISOString(),
    ]);
  }

  // Pindahkan kelompok ke preset baru
  const headers = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];
  const updated = kelompokList.map(k => k.id === kelompok_id ? { ...k, preset_id: newPresetId } : k);
  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${SHEETS.KELOMPOK}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.KELOMPOK}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers, ...updated.map(k => [k.id, k.user_id, k.nama_kelompok, k.tingkatan, k.desa, k.daerah, k.preset_id || '', k.created_at])] },
  });
  invalidateSheet(SHEETS.KELOMPOK);
  invalidateSheet(SHEETS.TARGET_PRESET);
  invalidateSheet(SHEETS.TARGET_ITEM);

  return NextResponse.json({ id: newPresetId, nama_preset });
}
