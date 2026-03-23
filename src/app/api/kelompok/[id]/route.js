import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  // Cek akses: owner ATAU admin yang diinvite
  const permission = await getPermission(session.user.email, id);
  if (!permission) return NextResponse.json({ error: 'Tidak punya akses ke kelompok ini' }, { status: 403 });

  const [kelompokList, muridList, jadwalList] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.JADWAL),
  ]);

  const kelompok = kelompokList.find(k => k.id === id);
  if (!kelompok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const murid = muridList.filter(m => m.kelompok_id === id);
  const jadwal = jadwalList.filter(j => j.kelompok_id === id);

  return NextResponse.json({ ...kelompok, murid, jadwal, permission });
}
