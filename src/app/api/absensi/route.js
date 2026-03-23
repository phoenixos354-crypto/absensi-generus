import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS, generateId, getGoogleSheetsClient, SPREADSHEET_ID } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  const tanggal = searchParams.get('tanggal');

  // Cek akses
  if (kelompok_id) {
    const perm = await getPermission(session.user.email, kelompok_id);
    if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  }

  const absensi = await readSheet(SHEETS.ABSENSI);
  let filtered = absensi;
  if (kelompok_id) filtered = filtered.filter(a => a.kelompok_id === kelompok_id);
  if (tanggal) filtered = filtered.filter(a => a.tanggal === tanggal);

  return NextResponse.json(filtered);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, tanggal, absensi } = await req.json();

  // Cek akses - minimal permission 'absen'
  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan, tidak bisa absen' }, { status: 403 });

  const existing = await readSheet(SHEETS.ABSENSI);
  const tetap = existing.filter(a => !(a.kelompok_id === kelompok_id && a.tanggal === tanggal));

  const newEntries = absensi.map(a => [
    generateId(), kelompok_id, a.murid_id, tanggal, a.status, session.user.email, new Date().toISOString(),
  ]);

  const headers = ['id', 'kelompok_id', 'murid_id', 'tanggal', 'status', 'dicatat_oleh', 'created_at'];
  const allRows = [
    headers,
    ...tetap.map(a => [a.id, a.kelompok_id, a.murid_id, a.tanggal, a.status, a.dicatat_oleh, a.created_at]),
    ...newEntries,
  ];

  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.ABSENSI}!A:Z`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.ABSENSI}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  });

  return NextResponse.json({ success: true, count: newEntries.length });
}
