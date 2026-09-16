import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readLatestByKeyWhere, appendRows, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

/**
 * POST /api/absensi-koreksi
 * Body: { kelompok_id, tanggal_asal, tanggal_tujuan }
 *
 * Cara kerja (append-only):
 * 1. Ambil absensi paling terakhir di tanggal_asal
 * 2. Salin ke tanggal_tujuan (baris baru = data berlaku)
 * 3. Timpa tanggal_asal dengan status 'Alfa' semua
 *    agar tanggal_asal dianggap "kosong/tidak ada sesi"
 *    — karena sistem append-only, baris terbaru yang menang.
 *
 * Hanya owner atau user dengan permission 'absen' yang boleh.
 */
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, tanggal_asal, tanggal_tujuan } = await req.json();

  if (!kelompok_id || !tanggal_asal || !tanggal_tujuan) {
    return NextResponse.json({ error: 'kelompok_id, tanggal_asal, dan tanggal_tujuan wajib diisi' }, { status: 400 });
  }

  if (tanggal_asal === tanggal_tujuan) {
    return NextResponse.json({ error: 'Tanggal asal dan tujuan tidak boleh sama' }, { status: 400 });
  }

  // Cek permission — minimal 'absen', bukan 'viewer'
  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan' }, { status: 403 });

  // 1. Ambil absensi terbaru di tanggal_asal
  const filters = { kelompok_id };
  const semuaAbsensi = await readLatestByKeyWhere(
    SHEETS.ABSENSI,
    filters,
    a => `${a.kelompok_id}|${a.murid_id}|${a.tanggal}`
  );

  const absensiAsal = semuaAbsensi.filter(a => a.tanggal === tanggal_asal);

  if (absensiAsal.length === 0) {
    return NextResponse.json({ error: `Tidak ada data absensi di tanggal ${tanggal_asal}` }, { status: 404 });
  }

  const now = new Date().toISOString();

  // 2. Salin ke tanggal_tujuan
  const barisTujuan = absensiAsal.map(a => [
    generateId(), kelompok_id, a.murid_id, tanggal_tujuan, a.status,
    session.user.email, now,
  ]);
  await appendRows(SHEETS.ABSENSI, barisTujuan);

  // 3. "Hapus" tanggal_asal dengan menimpa semua murid ke status 'Alfa'
  //    Ini pendekatan append-only: baris terbaru = data berlaku.
  //    Kalau tidak mau menyisakan jejak, cukup tidak timpa — 
  //    tapi agar tanggal_asal tidak muncul di rekap sebagai sesi valid,
  //    kita timpa semua ke Alfa.
  const barisTimpa = absensiAsal.map(a => [
    generateId(), kelompok_id, a.murid_id, tanggal_asal, 'Koreksi',
    session.user.email, now,
  ]);
  await appendRows(SHEETS.ABSENSI, barisTimpa);

  // 4. Salin juga sesi (jurnal + infaq) ke tanggal_tujuan
  const semuaSesi = await readLatestByKeyWhere(
    SHEETS.SESI,
    { kelompok_id },
    s => `${s.kelompok_id}|${s.tanggal}`
  );
  const sesiAsal = semuaSesi.find(s => s.tanggal === tanggal_asal);
  if (sesiAsal) {
    const { appendRow } = await import('@/lib/sheets');
    await appendRow(SHEETS.SESI, [
      generateId(), kelompok_id, tanggal_tujuan,
      sesiAsal.jurnal || '', sesiAsal.infaq || 0,
      session.user.email, now,
    ]);
    // Kosongkan sesi di tanggal_asal
    await appendRow(SHEETS.SESI, [
      generateId(), kelompok_id, tanggal_asal,
      '', 0, session.user.email, now,
    ]);
  }

  return NextResponse.json({
    success: true,
    dipindahkan: absensiAsal.length,
    dari: tanggal_asal,
    ke: tanggal_tujuan,
  });
}
