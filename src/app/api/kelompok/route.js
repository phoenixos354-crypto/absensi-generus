import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId } from '@/lib/sheets';
import { getKelompokAkses, normEmail } from '@/lib/permission';
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
    id, session.user.id, nama_kelompok, tingkatan, desa, daerah, null, new Date().toISOString(),
  ]);

  // Otomatis daftarkan pembuat sebagai owner (email dinormalisasi
  // supaya pencocokan akses tidak gagal gara-gara beda kapital)
  const emailOwner = normEmail(session.user.email);
  await appendRow(SHEETS.ADMIN_KELOMPOK, [
    generateId(), id, emailOwner, 'owner', emailOwner, new Date().toISOString(),
  ]);

  return NextResponse.json({ id, nama_kelompok, tingkatan, desa, daerah, permission: 'owner' });
}
