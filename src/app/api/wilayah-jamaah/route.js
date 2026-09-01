import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId, generateKodePublik } from '@/lib/sheets';
import { hitungStatsJamaah } from '@/lib/jamaah';
import { NextResponse } from 'next/server';

// GET /api/wilayah-jamaah -> daftar wilayah jamaah milik user, lengkap
// dengan rekap ringkas per wilayah (buat ditampilkan di kartu list).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [wilayahList, jamaahList] = await Promise.all([
    readSheet(SHEETS.WILAYAH_JAMAAH),
    readSheet(SHEETS.JAMAAH),
  ]);

  const milik = wilayahList.filter(w => w.user_id === session.user.id);
  const hasil = milik.map(w => {
    const anggota = jamaahList.filter(j => j.wilayah_id === w.id);
    return { ...w, stats: hitungStatsJamaah(anggota) };
  });

  return NextResponse.json(hasil);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nama_wilayah, desa, daerah } = await req.json();
  if (!nama_wilayah) return NextResponse.json({ error: 'Nama wilayah wajib diisi' }, { status: 400 });

  const id = generateId();
  const kode_publik = generateKodePublik();

  await appendRow(SHEETS.WILAYAH_JAMAAH, [
    id, session.user.id, nama_wilayah, desa || '', daerah || '', kode_publik, new Date().toISOString(),
  ]);

  return NextResponse.json({ id, nama_wilayah, desa, daerah, kode_publik });
}
