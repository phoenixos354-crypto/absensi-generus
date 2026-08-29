import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS, generateId, getGoogleSheetsClient, SPREADSHEET_ID, invalidateSheet } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

const NILAI_VALID = ['belum', 'A', 'B', 'C', 'D'];

// GET /api/target-progress?murid_id=...
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const murid_id = searchParams.get('murid_id');
  if (!murid_id) return NextResponse.json({ error: 'murid_id wajib diisi' }, { status: 400 });

  const muridList = await readSheet(SHEETS.MURID);
  const murid = muridList.find(m => m.id === murid_id);
  if (!murid) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const perm = await getPermission(session.user.email, murid.kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const semuaProgress = await readSheet(SHEETS.TARGET_PROGRESS);
  const progress = semuaProgress.filter(p => p.murid_id === murid_id);
  return NextResponse.json(progress);
}

// POST { murid_id, item_id, nilai }  -> upsert satu baris progress (item_id + murid_id unik)
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { murid_id, item_id, nilai } = await req.json();
  if (!NILAI_VALID.includes(nilai)) return NextResponse.json({ error: 'Nilai tidak valid' }, { status: 400 });

  const muridList = await readSheet(SHEETS.MURID);
  const murid = muridList.find(m => m.id === murid_id);
  if (!murid) return NextResponse.json({ error: 'Murid tidak ditemukan' }, { status: 404 });

  const perm = await getPermission(session.user.email, murid.kelompok_id);
  if (!perm || perm === 'viewer') return NextResponse.json({ error: 'Tidak punya akses untuk mencatat' }, { status: 403 });

  const existing = await readSheet(SHEETS.TARGET_PROGRESS);
  const tetap = existing.filter(p => !(p.murid_id === murid_id && p.item_id === item_id));

  const headers = ['id', 'murid_id', 'item_id', 'nilai', 'tanggal', 'dicatat_oleh', 'created_at'];
  const rows = [...tetap];
  // 'belum' berarti hapus catatan (gak perlu baris eksplisit, default-nya memang belum)
  if (nilai !== 'belum') {
    rows.push({
      id: generateId(), murid_id, item_id, nilai,
      tanggal: new Date().toISOString().split('T')[0],
      dicatat_oleh: session.user.email,
      created_at: new Date().toISOString(),
    });
  }

  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${SHEETS.TARGET_PROGRESS}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.TARGET_PROGRESS}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers, ...rows.map(p => [p.id, p.murid_id, p.item_id, p.nilai, p.tanggal, p.dicatat_oleh, p.created_at])] },
  });
  invalidateSheet(SHEETS.TARGET_PROGRESS);

  return NextResponse.json({ success: true });
}
