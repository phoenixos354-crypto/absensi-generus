import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId } from '@/lib/sheets';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kelompok = await readSheet(SHEETS.KELOMPOK);
  const milik = kelompok.filter(k => k.user_id === session.user.id);
  return NextResponse.json(milik);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nama_kelompok, tingkatan, desa, daerah } = await req.json();
  const id = generateId();
  await appendRow(SHEETS.KELOMPOK, [
    id,
    session.user.id,
    nama_kelompok,
    tingkatan,
    desa,
    daerah,
    new Date().toISOString(),
  ]);
  return NextResponse.json({ id, nama_kelompok, tingkatan, desa, daerah });
}
