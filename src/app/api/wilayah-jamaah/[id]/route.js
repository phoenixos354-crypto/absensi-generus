import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, updateRow, deleteRows, deleteWhere, SHEETS } from '@/lib/sheets';
import { hitungStatsJamaah } from '@/lib/jamaah';
import { NextResponse } from 'next/server';

const WILAYAH_HEADERS = ['id', 'user_id', 'nama_wilayah', 'desa', 'daerah', 'kode_publik', 'created_at'];

async function ambilWilayahMilikUser(id, userId) {
  const wilayahList = await readSheet(SHEETS.WILAYAH_JAMAAH);
  const wilayah = wilayahList.find(w => w.id === id);
  if (!wilayah || wilayah.user_id !== userId) return null;
  return wilayah;
}

// GET /api/wilayah-jamaah/[id] -> detail wilayah + daftar jamaah + stats
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const wilayah = await ambilWilayahMilikUser(params.id, session.user.id);
  if (!wilayah) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });

  const jamaahList = await readSheet(SHEETS.JAMAAH);
  const anggota = jamaahList.filter(j => j.wilayah_id === wilayah.id);

  return NextResponse.json({
    ...wilayah,
    jamaah: anggota,
    stats: hitungStatsJamaah(anggota),
  });
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const wilayah = await ambilWilayahMilikUser(params.id, session.user.id);
  if (!wilayah) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });

  const { nama_wilayah, desa, daerah } = await req.json();
  await updateRow(SHEETS.WILAYAH_JAMAAH, { ...wilayah, nama_wilayah, desa: desa || '', daerah: daerah || '' }, WILAYAH_HEADERS);

  return NextResponse.json({ success: true });
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const wilayah = await ambilWilayahMilikUser(params.id, session.user.id);
  if (!wilayah) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });

  // Hapus semua data jamaah di wilayah ini juga, baru wilayahnya sendiri.
  await deleteWhere(SHEETS.JAMAAH, { wilayah_id: wilayah.id });
  await deleteRows(SHEETS.WILAYAH_JAMAAH, [wilayah]);

  return NextResponse.json({ success: true });
}
