import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRows, deleteWhere, SHEETS, generateId } from '@/lib/sheets';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');

  const jadwal = await readSheet(SHEETS.JADWAL);
  const filtered = kelompok_id ? jadwal.filter(j => j.kelompok_id === kelompok_id) : jadwal;
  return NextResponse.json(filtered);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, hari } = await req.json();

  // Hapus jadwal lama untuk kelompok ini, lalu tulis yang baru.
  await deleteWhere(SHEETS.JADWAL, { kelompok_id });

  const newEntries = hari.map(h => [generateId(), kelompok_id, h, new Date().toISOString()]);
  await appendRows(SHEETS.JADWAL, newEntries);

  return NextResponse.json({ success: true, jadwal: newEntries.map(e => ({ id: e[0], kelompok_id: e[1], hari: e[2] })) });
}
