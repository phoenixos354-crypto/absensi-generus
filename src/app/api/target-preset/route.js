import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, appendRows, updateRow, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { getPresetTerlihat, DEFAULT_PRESET_ID } from '@/lib/target';
import { NextResponse } from 'next/server';

const KELOMPOK_HEADERS = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];

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

  // Duplikat semua item dari preset sumber ke preset baru (id baru semua), 1 request
  const semuaItem = await readSheet(SHEETS.TARGET_ITEM);
  const itemSumber = semuaItem.filter(i => i.preset_id === (source_preset_id || DEFAULT_PRESET_ID));
  await appendRows(SHEETS.TARGET_ITEM, itemSumber.map(item => [
    generateId(), newPresetId, item.tingkatan, item.kategori, item.urutan, item.nama_item, new Date().toISOString(), item.kelas || '',
  ]));

  // Pindahkan kelompok ke preset baru — update 1 baris saja
  await updateRow(SHEETS.KELOMPOK, { ...kelompok, preset_id: newPresetId }, KELOMPOK_HEADERS);

  return NextResponse.json({ id: newPresetId, nama_preset });
}
