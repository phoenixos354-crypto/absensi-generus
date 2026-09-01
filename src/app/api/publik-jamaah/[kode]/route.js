import { readSheet, SHEETS } from '@/lib/sheets';
import { hitungStatsJamaah } from '@/lib/jamaah';
import { NextResponse } from 'next/server';

// GET /api/publik-jamaah/[kode] -> TANPA LOGIN, cuma rekap ringkas (bukan
// daftar nama satu-satu) supaya aman dibagikan ke publik.
export async function GET(req, { params }) {
  const { kode } = params;

  const wilayahList = await readSheet(SHEETS.WILAYAH_JAMAAH);
  const wilayah = wilayahList.find(w => w.kode_publik === kode);
  if (!wilayah) return NextResponse.json({ error: 'Kode tidak ditemukan' }, { status: 404 });

  const jamaahList = await readSheet(SHEETS.JAMAAH);
  const anggota = jamaahList.filter(j => j.wilayah_id === wilayah.id);

  return NextResponse.json({
    nama_wilayah: wilayah.nama_wilayah,
    desa: wilayah.desa,
    daerah: wilayah.daerah,
    stats: hitungStatsJamaah(anggota),
  });
}
