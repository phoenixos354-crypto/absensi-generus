import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, readLatestByKeyWhere, appendRow, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

const NILAI_VALID = ['belum', 'A', 'B', 'C', 'D'];

// GET /api/target-progress?murid_id=...
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const murid_id = searchParams.get('murid_id');
  if (!murid_id) return NextResponse.json({ error: 'murid_id wajib diisi' }, { status: 400 });

  const muridList = await readSheet(SHEETS.MURID);
  const murid = muridList.find(m => m.id === murid_id);
  if (!murid) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const perm = await getPermission(session.user.email, murid.kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  // Append-only: tiap (murid_id + item_id) bisa punya beberapa baris riwayat,
  // ambil yang paling terakhir ditulis saja. Filter murid_id dilakukan DI
  // DATABASE, bukan tarik semua baris progress semua murid dulu.
  const progress = await readLatestByKeyWhere(SHEETS.TARGET_PROGRESS, { murid_id }, p => `${p.murid_id}|${p.item_id}`);
  return NextResponse.json(progress);
}

// POST { murid_id, item_id, nilai }  -> tambah 1 baris progress baru (append-only)
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { murid_id, item_id, nilai } = await req.json();
  if (!NILAI_VALID.includes(nilai)) return NextResponse.json({ error: 'Nilai tidak valid' }, { status: 400 });

  const muridList = await readSheet(SHEETS.MURID);
  const murid = muridList.find(m => m.id === murid_id);
  if (!murid) return NextResponse.json({ error: 'Murid tidak ditemukan' }, { status: 404 });

  const perm = await getPermission(session.user.email, murid.kelompok_id);
  if (!perm || perm === 'viewer') return NextResponse.json({ error: 'Tidak punya akses untuk mencatat' }, { status: 403 });

  // Cukup tambah 1 baris baru di bawah — baris ini otomatis jadi nilai yang
  // "berlaku" untuk (murid_id, item_id) ini karena readLatestByKey ambil
  // baris paling bawah. Tidak perlu baca-hapus-tulis ulang seluruh sheet,
  // jadi kecepatannya tidak tergantung berapa banyak riwayat yang sudah ada.
  await appendRow(SHEETS.TARGET_PROGRESS, [
    generateId(), murid_id, item_id, nilai,
    new Date().toISOString().split('T')[0],
    session.user.email,
    new Date().toISOString(),
  ]);

  return NextResponse.json({ success: true });
}
