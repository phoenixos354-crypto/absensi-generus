import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, readLatestByKeyWhereIn, SHEETS } from '@/lib/sheets';
import { getKelompokAkses } from '@/lib/permission';
import { NextResponse } from 'next/server';

/**
 * GET /api/rekap-global?mode=bulan&nilai=2026-05&tingkatan=semua
 *
 * Menggabungkan rekap SEMUA kelompok yang bisa diakses user (baik sebagai
 * owner maupun yang diinvite/punya akses lain), lalu meringkasnya jadi satu
 * paket data untuk ditampilkan di halaman "Rekap Gabungan".
 *
 * Response:
 * {
 *   stats: { total_murid, hadir_100, avg_persen, kelompok_aktif, total_hadir },
 *   tingkatan_counts: { caberawit: 126, praremaja: 35, ... },   // total murid per tingkatan (tidak terpengaruh filter tingkatan)
 *   kelompok_list: [{ id, nama_kelompok, tingkatan, desa, daerah, persen, total_murid, total_sesi }],
 *   top_murid: [{ murid_id, nama, kelompok_id, nama_kelompok, persen_hadir }],
 * }
 */
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'bulan';
  const nilai = searchParams.get('nilai');
  const tingkatanFilter = searchParams.get('tingkatan') || 'semua';

  // Semua kelompok yang bisa diakses user ini (owner + diinvite)
  const semuaKelompok = await getKelompokAkses(session.user.email, session.user.id);
  if (!semuaKelompok.length) {
    return NextResponse.json({
      stats: { total_murid: 0, hadir_100: 0, avg_persen: 0, kelompok_aktif: 0, total_hadir: 0 },
      tingkatan_counts: {},
      kelompok_list: [],
      top_murid: [],
    });
  }

  const muridAll = await readSheet(SHEETS.MURID);

  // Hitung total murid per tingkatan (independen dari filter tingkatan, untuk badge tab)
  const tingkatanCounts = {};
  for (const k of semuaKelompok) {
    const jumlahMurid = muridAll.filter(m => m.kelompok_id === k.id).length;
    tingkatanCounts[k.tingkatan] = (tingkatanCounts[k.tingkatan] || 0) + jumlahMurid;
  }

  // Terapkan filter tingkatan (kalau bukan 'semua')
  const kelompokList = tingkatanFilter === 'semua'
    ? semuaKelompok
    : semuaKelompok.filter(k => k.tingkatan === tingkatanFilter);

  const kelompokIds = kelompokList.map(k => k.id);
  // PENTING: absensi itu append-only (simpan ulang tanggal yang sama = baris
  // baru, bukan menimpa). Kalau tidak di-dedup, tanggal yang pernah disimpan
  // ulang akan ketitung dobel di rekap gabungan ini. Ambil baris TERBARU saja
  // per (kelompok,murid,tanggal), sekaligus filter di database via .in() —
  // cuma tarik baris punya kelompok yang relevan, bukan semua kelompok semua user.
  let absensi = await readLatestByKeyWhereIn(SHEETS.ABSENSI, 'kelompok_id', kelompokIds, a => `${a.kelompok_id}|${a.murid_id}|${a.tanggal}`);

  // Filter periode — sama seperti /api/rekap
  if (mode === 'hari' && nilai) {
    absensi = absensi.filter(a => a.tanggal === nilai);
  } else if (mode === 'minggu' && nilai) {
    absensi = absensi.filter(a => {
      const d = new Date(a.tanggal);
      const week = getWeekNumber(d);
      return `${d.getFullYear()}-${String(week).padStart(2, '0')}` === nilai;
    });
  } else if (mode === 'bulan' && nilai) {
    absensi = absensi.filter(a => a.tanggal.startsWith(nilai));
  }

  const kelompokRekap = [];
  const topMurid = [];

  let totalHadirGlobal = 0;
  let totalRecordGlobal = 0;
  let totalMuridGlobal = 0;
  let hadir100Global = 0;
  let kelompokAktif = 0;

  for (const k of kelompokList) {
    const muridKelompok = muridAll.filter(m => m.kelompok_id === k.id);
    const absensiKelompok = absensi.filter(a => a.kelompok_id === k.id);

    totalMuridGlobal += muridKelompok.length;

    const tanggalUnik = new Set(absensiKelompok.map(a => a.tanggal).filter(Boolean));
    if (tanggalUnik.size > 0) kelompokAktif += 1;

    let hadirKelompok = 0;
    let recordKelompok = 0;

    for (const m of muridKelompok) {
      const absMurid = absensiKelompok.filter(a => a.murid_id === m.id);
      const hadir = absMurid.filter(a => a.status === 'Hadir').length;
      const total = absMurid.length;
      const persenMurid = total > 0 ? Math.round((hadir / total) * 100) : null;

      hadirKelompok += hadir;
      recordKelompok += total;

      if (persenMurid === 100) {
        hadir100Global += 1;
        topMurid.push({
          murid_id: m.id,
          nama: m.nama_murid,
          kelompok_id: k.id,
          nama_kelompok: k.nama_kelompok,
          tingkatan: k.tingkatan,
          persen_hadir: persenMurid,
        });
      }
    }

    totalHadirGlobal += hadirKelompok;
    totalRecordGlobal += recordKelompok;

    const persenKelompok = recordKelompok > 0 ? Math.round((hadirKelompok / recordKelompok) * 100) : null;

    kelompokRekap.push({
      id: k.id,
      nama_kelompok: k.nama_kelompok,
      tingkatan: k.tingkatan,
      desa: k.desa,
      daerah: k.daerah,
      permission: k.permission,
      persen: persenKelompok,
      total_murid: muridKelompok.length,
      total_sesi: tanggalUnik.size,
    });
  }

  // Urutkan kelompok dari kehadiran tertinggi (yang belum ada data ditaruh paling bawah)
  kelompokRekap.sort((a, b) => (b.persen ?? -1) - (a.persen ?? -1));

  // Urutkan murid terbaik: per kelompok (sesuai urutan kelompok terbaik), lalu alfabetis
  const urutanKelompok = new Map(kelompokRekap.map((k, i) => [k.id, i]));
  topMurid.sort((a, b) => {
    const ra = urutanKelompok.get(a.kelompok_id) ?? 999;
    const rb = urutanKelompok.get(b.kelompok_id) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.nama.localeCompare(b.nama, 'id');
  });

  const avgPersen = totalRecordGlobal > 0 ? Math.round((totalHadirGlobal / totalRecordGlobal) * 100) : 0;

  return NextResponse.json({
    stats: {
      total_murid: totalMuridGlobal,
      hadir_100: hadir100Global,
      avg_persen: avgPersen,
      kelompok_aktif: kelompokAktif,
      total_hadir: totalHadirGlobal,
    },
    tingkatan_counts: tingkatanCounts,
    kelompok_list: kelompokRekap,
    top_murid: topMurid,
  });
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
