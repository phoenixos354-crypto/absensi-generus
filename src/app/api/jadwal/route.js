import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId } from '@/lib/sheets';
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

  // Hapus jadwal lama untuk kelompok ini, lalu tulis ulang
  // Karena Google Sheets tidak punya DELETE row langsung,
  // kita pakai pendekatan: baca semua, filter, tulis ulang
  const { google } = await import('googleapis');
  const { getGoogleSheetsClient, SPREADSHEET_ID } = await import('@/lib/sheets');
  const sheets = getGoogleSheetsClient();

  // Baca semua jadwal
  const allJadwal = await readSheet(SHEETS.JADWAL);
  const tetap = allJadwal.filter(j => j.kelompok_id !== kelompok_id);

  // Buat entri baru
  const newEntries = hari.map(h => [generateId(), kelompok_id, h, new Date().toISOString()]);

  // Gabungkan semua
  const headers = ['id', 'kelompok_id', 'hari', 'created_at'];
  const allRows = [
    headers,
    ...tetap.map(j => [j.id, j.kelompok_id, j.hari, j.created_at]),
    ...newEntries,
  ];

  // Tulis ulang sheet jadwal
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.JADWAL}!A:D`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  });

  return NextResponse.json({ success: true, jadwal: newEntries.map(e => ({ id: e[0], kelompok_id: e[1], hari: e[2] })) });
}
