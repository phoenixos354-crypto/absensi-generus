import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId, getGoogleSheetsClient, SPREADSHEET_ID } from '@/lib/sheets';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');

  const murid = await readSheet(SHEETS.MURID);
  const filtered = kelompok_id ? murid.filter(m => m.kelompok_id === kelompok_id) : murid;
  return NextResponse.json(filtered);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, nama_murid } = await req.json();
  const id = generateId();
  await appendRow(SHEETS.MURID, [id, kelompok_id, nama_murid, new Date().toISOString()]);
  return NextResponse.json({ id, kelompok_id, nama_murid });
}

// EDIT nama murid
export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, nama_murid } = await req.json();
  const allMurid = await readSheet(SHEETS.MURID);
  const updated = allMurid.map(m => m.id === id ? { ...m, nama_murid } : m);

  const headers = ['id', 'kelompok_id', 'nama_murid', 'created_at'];
  const allRows = [headers, ...updated.map(m => [m.id, m.kelompok_id, m.nama_murid, m.created_at])];

  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.MURID}!A:D`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  });
  return NextResponse.json({ success: true });
}

// HAPUS murid
export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const allMurid = await readSheet(SHEETS.MURID);
  const filtered = allMurid.filter(m => m.id !== id);

  const headers = ['id', 'kelompok_id', 'nama_murid', 'created_at'];
  const allRows = [headers, ...filtered.map(m => [m.id, m.kelompok_id, m.nama_murid, m.created_at])];

  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.MURID}!A:D`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  });
  return NextResponse.json({ success: true });
}
