import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  const mode = searchParams.get('mode') || 'bulan';
  const nilai = searchParams.get('nilai');

  // Cek akses
  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const [absensiAll, muridAll, sesiAll] = await Promise.all([
    readSheet(SHEETS.ABSENSI),
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.SESI),
  ]);

  let absensi = absensiAll.filter(a => a.kelompok_id === kelompok_id);
  let sesi = sesiAll.filter(s => s.kelompok_id === kelompok_id);

  if (mode === 'hari' && nilai) {
    absensi = absensi.filter(a => a.tanggal === nilai);
    sesi = sesi.filter(s => s.tanggal === nilai);
  } else if (mode === 'minggu' && nilai) {
    absensi = absensi.filter(a => {
      const d = new Date(a.tanggal);
      const week = getWeekNumber(d);
      return `${d.getFullYear()}-${String(week).padStart(2, '0')}` === nilai;
    });
    sesi = sesi.filter(s => {
      const d = new Date(s.tanggal);
      const week = getWeekNumber(d);
      return `${d.getFullYear()}-${String(week).padStart(2, '0')}` === nilai;
    });
  } else if (mode === 'bulan' && nilai) {
    absensi = absensi.filter(a => a.tanggal.startsWith(nilai));
    sesi = sesi.filter(s => s.tanggal.startsWith(nilai));
  }

  const murid = muridAll.filter(m => m.kelompok_id === kelompok_id);

  const rekapMurid = murid.map(m => {
    const absMurid = absensi.filter(a => a.murid_id === m.id);
    const hadir = absMurid.filter(a => a.status === 'Hadir').length;
    const alfa  = absMurid.filter(a => a.status === 'Alfa').length;
    const izin  = absMurid.filter(a => a.status === 'Izin').length;
    const sakit = absMurid.filter(a => a.status === 'Sakit').length;
    const total = hadir + alfa + izin + sakit;
    const persen = total > 0 ? Math.round((hadir / total) * 100) : 0;
    return { murid_id: m.id, nama: m.nama_murid, hadir, alfa, izin, sakit, total, persen_hadir: persen };
  });

  const totalHadir = rekapMurid.reduce((s, m) => s + m.hadir, 0);
  const totalSesi  = rekapMurid.reduce((s, m) => s + m.total, 0);
  const persenGlobal = totalSesi > 0 ? Math.round((totalHadir / totalSesi) * 100) : 0;
  const tanggalSet = [...new Set(absensi.map(a => a.tanggal))].sort();

  const daftarSesi = sesi
    .filter(s => s.jurnal || Number(s.infaq) > 0)
    .map(s => ({ tanggal: s.tanggal, jurnal: s.jurnal, infaq: Number(s.infaq) || 0 }))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const totalInfaq = sesi.reduce((s, x) => s + (Number(x.infaq) || 0), 0);

  return NextResponse.json({
    kelompok_id, mode, nilai,
    total_sesi: tanggalSet.length,
    tanggal_sesi: tanggalSet,
    persen_global: persenGlobal,
    rekap_murid: rekapMurid,
    total_infaq: totalInfaq,
    daftar_sesi: daftarSesi,
  });
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
