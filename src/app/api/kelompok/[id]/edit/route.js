import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, updateRow, deleteRows, SHEETS } from '@/lib/sheets';
import { NextResponse } from 'next/server';

const KELOMPOK_HEADERS = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];

// EDIT kelompok — update 1 baris saja
export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const { nama_kelompok, tingkatan, desa, daerah } = await req.json();

  const allKelompok = await readSheet(SHEETS.KELOMPOK);
  const target = allKelompok.find(k => k.id === id && k.user_id === session.user.id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await updateRow(SHEETS.KELOMPOK, { ...target, nama_kelompok, tingkatan, desa, daerah }, KELOMPOK_HEADERS);

  return NextResponse.json({ success: true });
}

// HAPUS kelompok — hapus baris spesifik saja di tiap sheet terkait
// (bukan baca-semua-tulis-ulang-semua). Baris yang gak nyambung ke
// kelompok ini di sheet lain sama sekali tidak disentuh.
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  const [allKelompok, allMurid, allJadwal, allAbsensi, allAdmin] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.JADWAL),
    readSheet(SHEETS.ABSENSI),
    readSheet(SHEETS.ADMIN_KELOMPOK),
  ]);

  const target = allKelompok.find(k => k.id === id && k.user_id === session.user.id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Tiap sheet dibersihkan sendiri-sendiri (sequential, biar aman dari
  // race condition nomor baris), tapi masing-masing cuma menghapus baris
  // yang benar-benar nyambung ke kelompok ini.
  await deleteRows(SHEETS.KELOMPOK, [target]);
  await deleteRows(SHEETS.MURID, allMurid.filter(m => m.kelompok_id === id));
  await deleteRows(SHEETS.JADWAL, allJadwal.filter(j => j.kelompok_id === id));
  await deleteRows(SHEETS.ABSENSI, allAbsensi.filter(a => a.kelompok_id === id));
  await deleteRows(SHEETS.ADMIN_KELOMPOK, allAdmin.filter(a => a.kelompok_id === id));

  return NextResponse.json({ success: true });
}
