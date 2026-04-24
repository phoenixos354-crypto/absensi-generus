import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS } from '@/lib/sheets';
import { getKelompokAkses } from '@/lib/permission';
import { NextResponse } from 'next/server';

/**
 * GET /api/rekap-ringkas
 * Mengembalikan ringkasan persentase kehadiran untuk semua kelompok milik user
 * dalam satu request — efisien, tidak perlu panggil rekap per-kelompok.
 *
 * Response:
 * {
 *   [kelompok_id]: {
 *     persen: number,        // 0–100, rata-rata kehadiran semua murid
 *     total_sesi: number,    // jumlah pertemuan unik
 *     total_murid: number,
 *     hadir: number,         // total record hadir
 *     total_absen: number,   // total semua record absensi
 *   }
 * }
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ambil semua kelompok yang boleh diakses user ini
  const kelompokList = await getKelompokAkses(session.user.email, session.user.id);
  if (!kelompokList.length) return NextResponse.json({});

  const kelompokIds = new Set(kelompokList.map(k => k.id));

  // Baca absensi & murid sekali saja
  const [absensiAll, muridAll] = await Promise.all([
    readSheet(SHEETS.ABSENSI),
    readSheet(SHEETS.MURID),
  ]);

  const result = {};

  for (const k of kelompokList) {
    const absensi = absensiAll.filter(a => a.kelompok_id === k.id);
    const murid   = muridAll.filter(m => m.kelompok_id === k.id);

    const totalHadir = absensi.filter(a => a.status === 'Hadir').length;
    const totalAbsen  = absensi.length; // semua record (Hadir+Alfa+Izin+Sakit)
    const persen = totalAbsen > 0 ? Math.round((totalHadir / totalAbsen) * 100) : null;

    // Jumlah pertemuan unik berdasar tanggal
    const tanggalUnik = new Set(absensi.map(a => a.tanggal).filter(Boolean));

    result[k.id] = {
      persen,          // null = belum ada data absensi sama sekali
      total_sesi: tanggalUnik.size,
      total_murid: murid.length,
      hadir: totalHadir,
      total_absen: totalAbsen,
    };
  }

  return NextResponse.json(result);
}
