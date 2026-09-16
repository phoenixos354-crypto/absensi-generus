import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readLatestByKeyWhere, readWhere, SHEETS } from '@/lib/sheets';
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

  // PENTING: absensi & sesi itu append-only (simpan ulang tanggal yang sama
  // = baris baru, bukan menimpa). Kalau tidak di-dedup, tanggal yang pernah
  // disimpan ulang akan KETITUNG DOBEL di rekap (persentase kehadiran &
  // total infaq jadi salah). readLatestByKeyWhere ambil baris TERBARU saja
  // per (murid,tanggal) / (kelompok,tanggal), sekaligus filter di database
  // (bukan tarik semua baris punya kelompok lain juga).
  const settled = await Promise.allSettled([
    readLatestByKeyWhere(SHEETS.ABSENSI, { kelompok_id }, a => `${a.kelompok_id}|${a.murid_id}|${a.tanggal}`),
    readWhere(SHEETS.MURID, { kelompok_id }),
    readLatestByKeyWhere(SHEETS.SESI, { kelompok_id }, s => `${s.kelompok_id}|${s.tanggal}`),
    readWhere(SHEETS.PENGELUARAN_INFAQ, { kelompok_id }),
    readLatestByKeyWhere(SHEETS.KAS, { kelompok_id }, k => `${k.kelompok_id}|${k.murid_id}|${k.tanggal}`),
  ]);
  const absensiAll = settled[0].status === 'fulfilled' ? settled[0].value : [];
  const murid = settled[1].status === 'fulfilled' ? settled[1].value : [];
  const sesiAll = settled[2].status === 'fulfilled' ? settled[2].value : [];
  const pengeluaranAll = settled[3].status === 'fulfilled' ? settled[3].value : [];
  const kasAll = settled[4].status === 'fulfilled' ? settled[4].value : [];

  let absensi = absensiAll;
  let sesi = sesiAll;
  let kas = kasAll;

  const cocokPeriode = (tgl) => {
    if (!nilai) return true;
    if (mode === 'hari') return tgl === nilai;
    if (mode === 'bulan') return tgl.startsWith(nilai);
    if (mode === 'tahun') return tgl.startsWith(nilai);
    if (mode === 'minggu') {
      const d = new Date(tgl);
      const week = getWeekNumber(d);
      return `${d.getFullYear()}-${String(week).padStart(2, '0')}` === nilai;
    }
    return true;
  };

  // Abaikan tanggal bekas koreksi (isinya cuma status 'Koreksi' semua)
  absensi = absensi.filter(a => cocokPeriode(a.tanggal));
  const tglKoreksi = new Set(absensi.filter(a => a.status === 'Koreksi').map(a => a.tanggal));
  absensi = absensi.filter(a => !tglKoreksi.has(a.tanggal));
  sesi = sesi.filter(s => cocokPeriode(s.tanggal));
  kas = kas.filter(k => cocokPeriode(k.tanggal));

  // Penyebut persen = jumlah sesi di periode ini (bukan jumlah baris per murid),
  // biar murid yang belum kebagian baris tetap kehitung Alfa.
  const sesiUnik = [...new Set(absensi.map(a => a.tanggal))].sort();
  const rekapMurid = murid.map(m => {
    const absMurid = absensi.filter(a => a.murid_id === m.id);
    const hadir = absMurid.filter(a => a.status === 'Hadir').length;
    const izin  = absMurid.filter(a => a.status === 'Izin').length;
    const sakit = absMurid.filter(a => a.status === 'Sakit').length;
    const alfa = sesiUnik.length - hadir - izin - sakit;
    const total = sesiUnik.length;
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
  const totalKas = kas.reduce((s, k) => s + (Number(k.jumlah) || 0), 0);
  const totalInfaq = sesi.reduce((s, x) => s + (Number(x.infaq) || 0), 0);

  // Filter pengeluaran sesuai periode yang sama, pisahkan sumber dana
  let pengeluaranInfaq = [];
  let pengeluaranKas = [];
  pengeluaranAll.forEach(p => {
    if (p.sumber_dana === 'kas') {
      pengeluaranKas.push(p);
    } else {
      pengeluaranInfaq.push(p);
    }
  });

  if (mode === 'hari' && nilai) {
    pengeluaranInfaq = pengeluaranInfaq.filter(p => p.tanggal === nilai);
    pengeluaranKas = pengeluaranKas.filter(p => p.tanggal === nilai);
  } else if (mode === 'minggu' && nilai) {
    const filterFn = p => {
      const d = new Date(p.tanggal);
      const week = getWeekNumber(d);
      return `${d.getFullYear()}-${String(week).padStart(2, '0')}` === nilai;
    };
    pengeluaranInfaq = pengeluaranInfaq.filter(filterFn);
    pengeluaranKas = pengeluaranKas.filter(filterFn);
  } else if ((mode === 'bulan' || mode === 'tahun') && nilai) {
    pengeluaranInfaq = pengeluaranInfaq.filter(p => p.tanggal.startsWith(nilai));
    pengeluaranKas = pengeluaranKas.filter(p => p.tanggal.startsWith(nilai));
  }

  const totalPengeluaranInfaq = pengeluaranInfaq.reduce((s, p) => s + (Number(p.jumlah) || 0), 0);
  const totalPengeluaranKas = pengeluaranKas.reduce((s, p) => s + (Number(p.jumlah) || 0), 0);
  const sisaInfaq = totalInfaq - totalPengeluaranInfaq;
  const sisaKas = totalKas - totalPengeluaranKas;

  // Breakdown 12 bulan khusus mode tahun (buat grafik batang frontend)
  let perBulan = null;
  if (mode === 'tahun' && nilai) {
    perBulan = [];
    for (let b = 1; b <= 12; b++) {
      const kunci = `${nilai}-${String(b).padStart(2, '0')}`;
      const absB = absensi.filter(a => a.tanggal.startsWith(kunci));
      const sesiB = sesi.filter(s => s.tanggal.startsWith(kunci));
      const kasB = kas.filter(k => k.tanggal.startsWith(kunci));
      const sesiUnikB = new Set(absB.map(a => a.tanggal)).size;
      const hadirB = absB.filter(a => a.status === 'Hadir').length;
      const totalSlotB = sesiUnikB * murid.length;
      perBulan.push({
        bulan: kunci,
        jumlah_sesi: sesiUnikB,
        persen_hadir: totalSlotB > 0 ? Math.round((hadirB / totalSlotB) * 100) : 0,
        total_infaq: sesiB.reduce((s, x) => s + (Number(x.infaq) || 0), 0),
        total_kas: kasB.reduce((s, x) => s + (Number(x.jumlah) || 0), 0),
      });
    }
  }
  return NextResponse.json({
    kelompok_id, mode, nilai,
    total_sesi: tanggalSet.length,
    tanggal_sesi: tanggalSet,
    persen_global: persenGlobal,
    rekap_murid: rekapMurid,
    total_infaq: totalInfaq,
    total_kas: totalKas,
    daftar_sesi: daftarSesi,
    total_pengeluaran: totalPengeluaranInfaq,
    total_pengeluaran_infaq: totalPengeluaranInfaq,
    total_pengeluaran_kas: totalPengeluaranKas,
    sisa_infaq: sisaInfaq,
    sisa_kas: sisaKas,
    daftar_pengeluaran: pengeluaranInfaq,
    daftar_pengeluaran_infaq: pengeluaranInfaq,
    daftar_pengeluaran_kas: pengeluaranKas,
    ...(perBulan ? { per_bulan: perBulan } : {}),
  });
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
