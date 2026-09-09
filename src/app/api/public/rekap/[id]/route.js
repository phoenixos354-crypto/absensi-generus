import { readSheet, readLatestByKeyWhere, readWhere, SHEETS } from '@/lib/sheets';
import { NextResponse } from 'next/server';

/**
 * GET /api/public/rekap/[id]?mode=bulan&nilai=2026-05
 * Public endpoint — no auth required.
 * Returns attendance data for a specific group.
 */
export async function GET(req, { params }) {
  const kelompokId = params.id;
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'bulan';
  const nilai = searchParams.get('nilai');

  // Get group details (public — no permission check)
  const allGroups = await readSheet(SHEETS.KELOMPOK);
  const kelompok = allGroups.find(k => k.id === kelompokId);
  if (!kelompok) {
    return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 });
  }

  const [absensiAll, muridAll, sesiAll, pengeluaranAll] = await Promise.all([
    readLatestByKeyWhere(SHEETS.ABSENSI, { kelompok_id: kelompokId }, a => `${a.kelompok_id}|${a.murid_id}|${a.tanggal}`),
    readSheet(SHEETS.MURID),
    readLatestByKeyWhere(SHEETS.SESI, { kelompok_id: kelompokId }, s => `${s.kelompok_id}|${s.tanggal}`),
    readWhere(SHEETS.PENGELUARAN_INFAQ, { kelompok_id: kelompokId }),
  ]);

  let absensi = absensiAll;
  let sesi = sesiAll;

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

  const murid = muridAll.filter(m => m.kelompok_id === kelompokId);

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

  let pengeluaran = pengeluaranAll.map(r => ({
    id: r.id,
    tanggal: r.tanggal,
    keterangan: r.keterangan || '',
    jumlah: Number(r.jumlah) || 0,
  }));

  if (mode === 'hari' && nilai) {
    pengeluaran = pengeluaran.filter(p => p.tanggal === nilai);
  } else if (mode === 'minggu' && nilai) {
    pengeluaran = pengeluaran.filter(p => {
      const d = new Date(p.tanggal);
      const week = getWeekNumber(d);
      return `${d.getFullYear()}-${String(week).padStart(2, '0')}` === nilai;
    });
  } else if (mode === 'bulan' && nilai) {
    pengeluaran = pengeluaran.filter(p => p.tanggal.startsWith(nilai));
  }

  pengeluaran.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  const totalPengeluaran = pengeluaran.reduce((s, p) => s + p.jumlah, 0);
  const sisaInfaq = totalInfaq - totalPengeluaran;

  return NextResponse.json({
    kelompok_id: kelompokId,
    kelompok_nama: kelompok.nama_kelompok,
    tingkatan: kelompok.tingkatan,
    desa: kelompok.desa,
    daerah: kelompok.daerah,
    mode, nilai,
    total_sesi: tanggalSet.length,
    tanggal_sesi: tanggalSet,
    persen_global: persenGlobal,
    rekap_murid: rekapMurid,
    total_infaq: totalInfaq,
    daftar_sesi: daftarSesi,
    total_pengeluaran: totalPengeluaran,
    sisa_infaq: sisaInfaq,
    daftar_pengeluaran: pengeluaran,
  });
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}