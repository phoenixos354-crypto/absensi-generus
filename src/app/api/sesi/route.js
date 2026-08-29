import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS, generateId, getGoogleSheetsClient, SPREADSHEET_ID, invalidateSheet } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

// GET /api/sesi?kelompok_id=...&tanggal=...   -> satu sesi spesifik (untuk form isi)
// GET /api/sesi?kelompok_id=...                -> semua sesi kelompok itu (untuk rekap)
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  const tanggal = searchParams.get('tanggal');

  if (kelompok_id) {
    const perm = await getPermission(session.user.email, kelompok_id);
    if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  }

  const sesi = await readSheet(SHEETS.SESI);
  let filtered = sesi;
  if (kelompok_id) filtered = filtered.filter(s => s.kelompok_id === kelompok_id);
  if (tanggal) filtered = filtered.filter(s => s.tanggal === tanggal);

  return NextResponse.json(filtered);
}

// POST { kelompok_id, tanggal, jurnal, infaq }
// Satu sesi = satu baris per (kelompok_id, tanggal). Kalau sudah ada, ditimpa.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, tanggal, jurnal, infaq } = await req.json();

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan' }, { status: 403 });

  // Infaq kosong dianggap 0, tapi baris tetap disimpan supaya tanggal sesi
  // (dan jurnalnya kalau ada) tetap tercatat.
  const infaqNum = infaq === '' || infaq == null ? 0 : Number(infaq) || 0;

  const existing = await readSheet(SHEETS.SESI);
  const tetap = existing.filter(s => !(s.kelompok_id === kelompok_id && s.tanggal === tanggal));

  const headers = ['id', 'kelompok_id', 'tanggal', 'jurnal', 'infaq', 'dicatat_oleh', 'created_at'];
  const newRow = [generateId(), kelompok_id, tanggal, jurnal || '', infaqNum, session.user.email, new Date().toISOString()];

  const allRows = [
    headers,
    ...tetap.map(s => [s.id, s.kelompok_id, s.tanggal, s.jurnal, s.infaq, s.dicatat_oleh, s.created_at]),
    newRow,
  ];

  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SESI}!A:Z`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.SESI}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  });
  invalidateSheet(SHEETS.SESI);

  return NextResponse.json({ success: true });
}
