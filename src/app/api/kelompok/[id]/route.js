import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS } from '@/lib/sheets';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  const [kelompokList, muridList, jadwalList] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.JADWAL),
  ]);

  const kelompok = kelompokList.find(k => k.id === id && k.user_id === session.user.id);
  if (!kelompok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const murid = muridList.filter(m => m.kelompok_id === id);
  const jadwal = jadwalList.filter(j => j.kelompok_id === id);

  return NextResponse.json({ ...kelompok, murid, jadwal });
}
