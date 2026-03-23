import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId } from '@/lib/sheets';
import { getKelompokAkses } from '@/lib/permission';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kelompok = await getKelompokAkses(session.user.email, session.user.id);
  return NextResponse.json(kelompok);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nama_kelompok, tingkatan, desa, daerah } = await req.json();
  const id = generateId();

  await appendRow(SHEETS.KELOMPOK, [
    id, session.user.id, nama_kelompok, tingkatan, desa, daerah, new Date().toISOString(),
  ]);

  // Otomatis daftarkan pembuat sebagai owner
  await appendRow(SHEETS.ADMIN_KELOMPOK, [
    generateId(), id, session.user.email, 'owner', session.user.email, new Date().toISOString(),
  ]);

  return NextResponse.json({ id, nama_kelompok, tingkatan, desa, daerah, permission: 'owner' });
}
