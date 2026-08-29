import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readLatestByKey, appendRow, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

// GET /api/sesi?kelompok_id=...&tanggal=...   -> satu sesi spesifik (untuk form isi)
// GET /api/sesi?kelompok_id=...                -> semua sesi kelompok itu (untuk rekap)
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  const tanggal = searchParams.get('tanggal');

  if (kelompok_id) {
    const perm = await getPermission(session.user.email, kelompok_id);
    if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  }

  // Append-only: kalau sesi yang sama diedit ulang, baris terbaru yang dipakai.
  const sesi = await readLatestByKey(SHEETS.SESI, s => `${s.kelompok_id}|${s.tanggal}`);
  let filtered = sesi;
  if (kelompok_id) filtered = filtered.filter(s => s.kelompok_id === kelompok_id);
  if (tanggal) filtered = filtered.filter(s => s.tanggal === tanggal);

  return NextResponse.json(filtered);
}

// POST { kelompok_id, tanggal, jurnal, infaq }
// Satu sesi = satu baris per (kelompok_id, tanggal). Kalau diisi ulang,
// tinggal tambah baris baru — baris terbaru yang dianggap berlaku (lihat GET).
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, tanggal, jurnal, infaq } = await req.json();

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan' }, { status: 403 });

  // Infaq kosong dianggap 0, tapi baris tetap disimpan supaya tanggal sesi
  // (dan jurnalnya kalau ada) tetap tercatat.
  const infaqNum = infaq === '' || infaq == null ? 0 : Number(infaq) || 0;

  await appendRow(SHEETS.SESI, [
    generateId(), kelompok_id, tanggal, jurnal || '', infaqNum, session.user.email, new Date().toISOString(),
  ]);

  return NextResponse.json({ success: true });
}
