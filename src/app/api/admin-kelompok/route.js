import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId, getGoogleSheetsClient, SPREADSHEET_ID } from '@/lib/sheets';
import { NextResponse } from 'next/server';

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

  // Pastikan yang invite adalah owner
  const admins = await readSheet(SHEETS.ADMIN_KELOMPOK);
  const isOwner = admins.find(a =>
    a.kelompok_id === kelompok_id &&
    a.email === session.user.email &&
    a.permission === 'owner'
  );
  if (!isOwner) return NextResponse.json({ error: 'Hanya owner yang bisa invite admin' }, { status: 403 });

  // Cek apakah sudah ada
  const sudahAda = admins.find(a => a.kelompok_id === kelompok_id && a.email === email);
  if (sudahAda) return NextResponse.json({ error: 'Email ini sudah jadi admin' }, { status: 400 });

  const id = generateId();
  await appendRow(SHEETS.ADMIN_KELOMPOK, [
    id, kelompok_id, email, permission, session.user.email, new Date().toISOString()
  ]);

  return NextResponse.json({ id, kelompok_id, email, permission });
}

// DELETE — hapus admin
export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const kelompok_id = searchParams.get('kelompok_id');

  // Pastikan yang hapus adalah owner
  const admins = await readSheet(SHEETS.ADMIN_KELOMPOK);
  const isOwner = admins.find(a =>
    a.kelompok_id === kelompok_id &&
    a.email === session.user.email &&
    a.permission === 'owner'
  );
  if (!isOwner) return NextResponse.json({ error: 'Hanya owner yang bisa hapus admin' }, { status: 403 });

  const filtered = admins.filter(a => a.id !== id);
  const headers = ['id', 'kelompok_id', 'email', 'permission', 'invited_by', 'created_at'];
  const allRows = [headers, ...filtered.map(a => [a.id, a.kelompok_id, a.email, a.permission, a.invited_by, a.created_at])];

  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.ADMIN_KELOMPOK}!A:F`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  });

  return NextResponse.json({ success: true });
}
