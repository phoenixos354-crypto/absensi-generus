import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId, generateKodePublik } from '@/lib/sheets';
import { hitungStatsJamaah } from '@/lib/jamaah';
import { NextResponse } from 'next/server';

// GET /api/kelompok-jamaah -> daftar kelompok jamaah milik user, lengkap
// dengan rekap ringkas per kelompok (buat ditampilkan di kartu list).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [kelompokList, jamaahList] = await Promise.all([
    readSheet(SHEETS.KELOMPOK_JAMAAH),
    readSheet(SHEETS.JAMAAH),
  ]);

  const milik = kelompokList.filter(k => k.user_id === session.user.id);
  const hasil = milik.map(k => {
    const anggota = jamaahList.filter(j => j.kelompok_id === k.id);
    return { ...k, stats: hitungStatsJamaah(anggota) };
  });

  return NextResponse.json(hasil);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nama_kelompok, desa, daerah } = await req.json();
  if (!nama_kelompok) return NextResponse.json({ error: 'Nama kelompok wajib diisi' }, { status: 400 });

  const id = generateId();
  const kode_publik = generateKodePublik();

  await appendRow(SHEETS.KELOMPOK_JAMAAH, [
    id, session.user.id, nama_kelompok, desa || '', daerah || '', kode_publik, new Date().toISOString(),
  ]);

  return NextResponse.json({ id, nama_kelompok, desa, daerah, kode_publik });
}
