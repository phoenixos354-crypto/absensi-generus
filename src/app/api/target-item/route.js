import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRows, deleteRows, SHEETS, generateId } from '@/lib/sheets';
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
// Cuma bisa dipakai kalau kelompok ini MEMANG pemilik custom target yang
// sedang diikuti (bukan Target Default, bukan custom target kelompok lain).
// Tidak ada lagi auto-fork diam-diam — kalau belum punya custom target
// sendiri, harus eksplisit "Buat Custom Target Baru" dulu di halaman
// Kelola Target (endpoint POST /api/target-preset).
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

  const presetId = resolvePresetId(kelompok);
  if (presetId === DEFAULT_PRESET_ID) {
    return NextResponse.json({ error: 'Target Default tidak bisa diedit. Buat Custom Target dulu di halaman Kelola Target.' }, { status: 400 });
  }
  const presetSaatIni = semuaPreset.find(p => p.id === presetId);
  const milikSendiri = presetSaatIni?.dibuat_oleh_kelompok_id === kelompok_id;
  if (!milikSendiri) {
    return NextResponse.json({ error: 'Target ini bukan custom target kelompok kamu, jadi tidak bisa diedit. Buat Custom Target sendiri dulu di halaman Kelola Target.' }, { status: 400 });
  }

  // Preset ini milik kelompok sendiri — cukup hapus baris-baris LAMA di
  // kategori+tingkatan yang diedit ini saja, item kategori lain tidak disentuh.
  const itemLamaKategoriIni = semuaItem.filter(i =>
    i.preset_id === presetId && i.tingkatan === tingkatan && i.kategori === kategori
  );
  await deleteRows(SHEETS.TARGET_ITEM, itemLamaKategoriIni);

  // Tambah baris-baris baru untuk kategori+tingkatan ini
  const baru = (items || []).map((it, idx) => [
    it.id || generateId(), presetId, tingkatan, kategori, idx + 1, it.nama_item, new Date().toISOString(), it.kelas || '',
  ]);
  await appendRows(SHEETS.TARGET_ITEM, baru);

  return NextResponse.json({ success: true, preset_id: presetId });
}
