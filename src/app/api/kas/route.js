import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readLatestByKeyWhere, appendRows, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

// GET /api/kas?kelompok_id=...&tanggal=...
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  const tanggal = searchParams.get('tanggal');

  if (!kelompok_id) return NextResponse.json({ error: 'kelompok_id wajib' }, { status: 400 });

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const rows = await readLatestByKeyWhere(
    SHEETS.KAS,
    { kelompok_id },
    k => `${k.kelompok_id}|${k.murid_id}|${k.tanggal}`
  );
  const filtered = tanggal ? rows.filter(k => k.tanggal === tanggal) : rows;
  return NextResponse.json(filtered);
}

// POST { kelompok_id, tanggal, kas: [{ murid_id, jumlah }] }
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, tanggal, kas } = await req.json();
  if (!kelompok_id || !tanggal || !Array.isArray(kas)) {
    return NextResponse.json({ error: 'kelompok_id, tanggal, dan kas array wajib' }, { status: 400 });
  }

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan' }, { status: 403 });

  const newEntries = kas.map(k => [
    generateId(),
    kelompok_id,
    k.murid_id,
    tanggal,
    Number(k.jumlah) || 0,
    session.user.email,
    new Date().toISOString(),
  ]);
  await appendRows(SHEETS.KAS, newEntries);

  return NextResponse.json({ success: true, count: newEntries.length });
}
