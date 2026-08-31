import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, readLatestByKeyWhereIn, SHEETS } from '@/lib/sheets';
import { getKelompokAkses } from '@/lib/permission';
import { NextResponse } from 'next/server';

/**
 * GET /api/rekap-ringkas?bulan=2026-08
 * Mengembalikan ringkasan persentase kehadiran untuk semua kelompok milik user
 * dalam satu request — efisien, tidak perlu panggil rekap per-kelompok.
 * Persentase dihitung khusus untuk bulan yang diminta (default: bulan berjalan),
 * BUKAN akumulasi dari semua data sejak awal.
 *
 * Response:
 * {
 *   [kelompok_id]: {
 *     persen: number,        // 0–100, rata-rata kehadiran semua murid di bulan ini
 *     total_sesi: number,    // jumlah pertemuan unik di bulan ini
 *     total_murid: number,
 *     hadir: number,         // total record hadir di bulan ini
 *     total_absen: number,   // total semua record absensi di bulan ini
 *   }
 * }
 */
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const bulan = searchParams.get('bulan') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Ambil semua kelompok yang boleh diakses user ini
  const kelompokList = await getKelompokAkses(session.user.email, session.user.id);
  if (!kelompokList.length) return NextResponse.json({});

  // Baca absensi & murid, lalu batasi ke bulan yang diminta.
  // PENTING: absensi itu append-only — kalau tidak di-dedup, tanggal yang
  // pernah disimpan ulang bakal ketitung dobel di persentase dashboard ini.
  // Ambil baris TERBARU saja per (kelompok,murid,tanggal), filter ke kelompok
  // yang relevan langsung di database (bukan tarik punya semua user).
  const kelompokIds = kelompokList.map(k => k.id);
  const [absensiDeduped, muridAll] = await Promise.all([
    readLatestByKeyWhereIn(SHEETS.ABSENSI, 'kelompok_id', kelompokIds, a => `${a.kelompok_id}|${a.murid_id}|${a.tanggal}`),
    readSheet(SHEETS.MURID),
  ]);
  const absensiAll = absensiDeduped.filter(a => a.tanggal?.startsWith(bulan));

  const result = {};

  for (const k of kelompokList) {
    const absensi = absensiAll.filter(a => a.kelompok_id === k.id);
    const murid   = muridAll.filter(m => m.kelompok_id === k.id);

    const totalHadir = absensi.filter(a => a.status === 'Hadir').length;
    const totalAbsen  = absensi.length; // semua record (Hadir+Alfa+Izin+Sakit) di bulan ini
    const persen = totalAbsen > 0 ? Math.round((totalHadir / totalAbsen) * 100) : null;

    // Jumlah pertemuan unik berdasar tanggal, di bulan ini saja
    const tanggalUnik = new Set(absensi.map(a => a.tanggal).filter(Boolean));

    result[k.id] = {
      persen,          // null = belum ada data absensi di bulan ini
      total_sesi: tanggalUnik.size,
      total_murid: murid.length,
      hadir: totalHadir,
      total_absen: totalAbsen,
    };
  }

  return NextResponse.json(result);
}
