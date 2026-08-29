import { readSheet, SHEETS } from '@/lib/sheets';
import { KATEGORI, resolvePresetId } from '@/lib/target';
import { NextResponse } from 'next/server';

// GET /api/publik/[kode]?bulan=YYYY-MM  -> TANPA LOGIN, cuma data read-only untuk orang tua
export async function GET(req, { params }) {
  const { kode } = params;
  const { searchParams } = new URL(req.url);
  const bulan = searchParams.get('bulan'); // opsional, format YYYY-MM

  const [muridList, kelompokList, absensiList, sesiList, itemList, progressList] = await Promise.all([
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.ABSENSI),
    readSheet(SHEETS.SESI),
    readSheet(SHEETS.TARGET_ITEM),
    readSheet(SHEETS.TARGET_PROGRESS),
  ]);

  const murid = muridList.find(m => m.kode_publik === kode);
  if (!murid) return NextResponse.json({ error: 'Kode tidak ditemukan' }, { status: 404 });

  const kelompok = kelompokList.find(k => k.id === murid.kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Kehadiran keseluruhan (sejak awal)
  const absensiMurid = absensiList.filter(a => a.murid_id === murid.id);
  const totalSesiAbsen = absensiMurid.length;
  const totalHadir = absensiMurid.filter(a => a.status === 'Hadir').length;
  const persenHadir = totalSesiAbsen > 0 ? Math.round((totalHadir / totalSesiAbsen) * 100) : 0;

  // Kehadiran per bulan yang dipilih
  const absensiBulan = bulan ? absensiMurid.filter(a => a.tanggal.startsWith(bulan)) : absensiMurid;
  const totalSesiBulan = absensiBulan.length;
  const totalHadirBulan = absensiBulan.filter(a => a.status === 'Hadir').length;
  const persenHadirBulan = totalSesiBulan > 0 ? Math.round((totalHadirBulan / totalSesiBulan) * 100) : 0;

  // Jurnal dari sesi-sesi yang dia hadiri
  const tanggalHadir = new Set(absensiMurid.filter(a => a.status === 'Hadir').map(a => a.tanggal));
  const jurnal = sesiList
    .filter(s => s.kelompok_id === murid.kelompok_id && tanggalHadir.has(s.tanggal) && s.jurnal)
    .map(s => ({ tanggal: s.tanggal, jurnal: s.jurnal }))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  // Progress target per kategori (item sesuai tingkatan kelompoknya)
  const presetId = resolvePresetId(kelompok);
  const progressMap = {};
  progressList.filter(p => p.murid_id === murid.id).forEach(p => { progressMap[p.item_id] = p.nilai; });

  const targetPerKategori = KATEGORI.map(kat => {
    const items = itemList
      .filter(i => i.preset_id === presetId && i.tingkatan === kelompok.tingkatan && i.kategori === kat.key)
      .sort((a, b) => Number(a.urutan) - Number(b.urutan))
      .map(i => ({ nama_item: i.nama_item, nilai: progressMap[i.id] || 'belum' }));
    const tercapai = items.filter(i => i.nilai !== 'belum').length;
    return { key: kat.key, label: kat.label, items, tercapai, total: items.length };
  });

  return NextResponse.json({
    nama_murid: murid.nama_murid,
    nama_kelompok: kelompok.nama_kelompok,
    tingkatan: kelompok.tingkatan,
    desa: kelompok.desa,
    daerah: kelompok.daerah,
    persen_hadir: persenHadir,
    total_sesi: totalSesiAbsen,
    total_hadir: totalHadir,
    bulan,
    persen_hadir_bulan: persenHadirBulan,
    total_sesi_bulan: totalSesiBulan,
    total_hadir_bulan: totalHadirBulan,
    jurnal,
    target: targetPerKategori,
  });
}
