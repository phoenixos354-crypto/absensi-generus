import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId, getGoogleSheetsClient, SPREADSHEET_ID, invalidateSheet } from '@/lib/sheets';
import { NextResponse } from 'next/server';

// Helper: clear + tulis ulang sheet admin
async function tulisAdminSheet(sheets, rows) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.ADMIN_KELOMPOK}!A:Z`,
  });
  const headers = ['id', 'kelompok_id', 'email', 'permission', 'invited_by', 'created_at'];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.ADMIN_KELOMPOK}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [headers, ...rows.map(a => [a.id, a.kelompok_id, a.email, a.permission, a.invited_by, a.created_at])]
    },
  });
}

// GET — list admin untuk kelompok tertentu
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');

  const admins = await readSheet(SHEETS.ADMIN_KELOMPOK);
  const filtered = admins.filter(a => a.kelompok_id === kelompok_id);
  return NextResponse.json(filtered);
}

// POST — invite admin baru
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, email, permission } = await req.json();

  const admins = await readSheet(SHEETS.ADMIN_KELOMPOK);

  // Cek owner lewat email (bukan user_id)
  const isOwner = admins.find(a =>
    a.kelompok_id === kelompok_id &&
    a.email === session.user.email &&
    a.permission === 'owner'
  );
  if (!isOwner) return NextResponse.json({ error: 'Hanya owner yang bisa invite admin' }, { status: 403 });

  // Cek duplikat
  const sudahAda = admins.find(a => a.kelompok_id === kelompok_id && a.email === email);
  if (sudahAda) return NextResponse.json({ error: 'Email ini sudah jadi admin' }, { status: 400 });

  const id = generateId();
  await appendRow(SHEETS.ADMIN_KELOMPOK, [
    id, kelompok_id, email, permission, session.user.email, new Date().toISOString()
  ]);

  return NextResponse.json({ id, kelompok_id, email, permission });
}

// DELETE — hapus admin (pakai clear + tulis ulang agar bersih)
export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const kelompok_id = searchParams.get('kelompok_id');

  const admins = await readSheet(SHEETS.ADMIN_KELOMPOK);

  // Cek owner lewat email
  const isOwner = admins.find(a =>
    a.kelompok_id === kelompok_id &&
    a.email === session.user.email &&
    a.permission === 'owner'
  );
  if (!isOwner) return NextResponse.json({ error: 'Hanya owner yang bisa hapus admin' }, { status: 403 });

  // Jangan hapus diri sendiri (owner)
  const target = admins.find(a => a.id === id);
  if (target?.email === session.user.email) {
    return NextResponse.json({ error: 'Tidak bisa menghapus diri sendiri sebagai owner' }, { status: 400 });
  }

  const filtered = admins.filter(a => a.id !== id);
  const sheets = getGoogleSheetsClient();
  await tulisAdminSheet(sheets, filtered);
  invalidateSheet(SHEETS.ADMIN_KELOMPOK);

  return NextResponse.json({ success: true });
}
