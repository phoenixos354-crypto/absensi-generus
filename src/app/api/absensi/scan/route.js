import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readWhere, appendRow, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

// POST /api/absensi/scan { kode_publik, kelompok_id, tanggal }
// Cari murid via kode_publik, catat Hadir + jam sekarang (append-only).
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kode_publik, kelompok_id, tanggal } = await req.json();
  if (!kode_publik || !kelompok_id || !tanggal) {
    return NextResponse.json({ error: 'kode_publik, kelompok_id, dan tanggal wajib' }, { status: 400 });
  }

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan' }, { status: 403 });

  const kode = String(kode_publik).trim();
  let murid = (await readWhere(SHEETS.MURID, { kode_publik: kode }))[0];
  if (!murid) murid = (await readWhere(SHEETS.MURID, { id: kode }))[0];
  if (!murid) return NextResponse.json({ error: 'Kode QR tidak dikenal' }, { status: 404 });
  if (murid.kelompok_id !== kelompok_id) {
    return NextResponse.json({ error: 'Kartu ini milik kelompok lain' }, { status: 400 });
  }

  const now = new Date();
  const jam = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  await appendRow(SHEETS.ABSENSI, [
    generateId(), kelompok_id, murid.id, tanggal, 'Hadir', session.user.email, now.toISOString(), jam,
  ]);

  return NextResponse.json({ success: true, nama: murid.nama_murid, murid_id: murid.id, jam_datang: jam });
}
