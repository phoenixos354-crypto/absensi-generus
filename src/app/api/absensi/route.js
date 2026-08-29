import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readLatestByKey, appendRows, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  const tanggal = searchParams.get('tanggal');

  // Cek akses
  if (kelompok_id) {
    const perm = await getPermission(session.user.email, kelompok_id);
    if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  }

  // Append-only: tiap (kelompok_id + murid_id + tanggal) bisa punya beberapa
  // baris riwayat kalau statusnya diubah-ubah, ambil yang paling terakhir saja.
  const absensi = await readLatestByKey(SHEETS.ABSENSI, a => `${a.kelompok_id}|${a.murid_id}|${a.tanggal}`);
  let filtered = absensi;
  if (kelompok_id) filtered = filtered.filter(a => a.kelompok_id === kelompok_id);
  if (tanggal) filtered = filtered.filter(a => a.tanggal === tanggal);

  return NextResponse.json(filtered);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, tanggal, absensi } = await req.json();

  // Cek akses - minimal permission 'absen'
  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan, tidak bisa absen' }, { status: 403 });

  // Cukup tambah baris-baris baru di bawah — baris terbaru per murid+tanggal
  // otomatis jadi status yang "berlaku" (lihat GET di atas). Tidak perlu
  // baca-hapus-tulis ulang seluruh sheet absensi.
  const newEntries = absensi.map(a => [
    generateId(), kelompok_id, a.murid_id, tanggal, a.status, session.user.email, new Date().toISOString(),
  ]);
  await appendRows(SHEETS.ABSENSI, newEntries);

  return NextResponse.json({ success: true, count: newEntries.length });
}
