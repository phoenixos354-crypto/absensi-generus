import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, updateRow, deleteRows, deleteWhere, SHEETS } from '@/lib/sheets';
import { hitungStatsJamaah } from '@/lib/jamaah';
import { NextResponse } from 'next/server';

const KELOMPOK_HEADERS = ['id', 'user_id', 'nama_kelompok', 'desa', 'daerah', 'kode_publik', 'created_at'];

async function ambilKelompokMilikUser(id, userId) {
  const kelompokList = await readSheet(SHEETS.KELOMPOK_JAMAAH);
  const kelompok = kelompokList.find(k => k.id === id);
  if (!kelompok || kelompok.user_id !== userId) return null;
  return kelompok;
}

// GET /api/kelompok-jamaah/[id] -> detail kelompok + daftar jamaah + stats
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kelompok = await ambilKelompokMilikUser(params.id, session.user.id);
  if (!kelompok) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });

  const jamaahList = await readSheet(SHEETS.JAMAAH);
  const anggota = jamaahList.filter(j => j.kelompok_id === kelompok.id);

  return NextResponse.json({
    ...kelompok,
    jamaah: anggota,
    stats: hitungStatsJamaah(anggota),
  });
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kelompok = await ambilKelompokMilikUser(params.id, session.user.id);
  if (!kelompok) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });

  const { nama_kelompok, desa, daerah } = await req.json();
  await updateRow(SHEETS.KELOMPOK_JAMAAH, { ...kelompok, nama_kelompok, desa: desa || '', daerah: daerah || '' }, KELOMPOK_HEADERS);

  return NextResponse.json({ success: true });
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kelompok = await ambilKelompokMilikUser(params.id, session.user.id);
  if (!kelompok) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });

  // Hapus semua data jamaah di kelompok ini juga, baru kelompoknya sendiri.
  await deleteWhere(SHEETS.JAMAAH, { kelompok_id: kelompok.id });
  await deleteRows(SHEETS.KELOMPOK_JAMAAH, [kelompok]);

  return NextResponse.json({ success: true });
}
