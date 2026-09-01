import { readSheet, SHEETS } from '@/lib/sheets';
import { hitungStatsJamaah } from '@/lib/jamaah';
import { NextResponse } from 'next/server';

// GET /api/publik-jamaah/[kode] -> TANPA LOGIN, cuma rekap ringkas (bukan
// daftar nama satu-satu) supaya aman dibagikan ke publik.
export async function GET(req, { params }) {
  const { kode } = params;

  const kelompokList = await readSheet(SHEETS.KELOMPOK_JAMAAH);
  const kelompok = kelompokList.find(k => k.kode_publik === kode);
  if (!kelompok) return NextResponse.json({ error: 'Kode tidak ditemukan' }, { status: 404 });

  const jamaahList = await readSheet(SHEETS.JAMAAH);
  const anggota = jamaahList.filter(j => j.kelompok_id === kelompok.id);

  return NextResponse.json({
    nama_kelompok: kelompok.nama_kelompok,
    desa: kelompok.desa,
    daerah: kelompok.daerah,
    stats: hitungStatsJamaah(anggota),
  });
}
