import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, updateRow, deleteRows, SHEETS, generateId, generateKodePublik } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

const MURID_HEADERS = ['id', 'kelompok_id', 'nama_murid', 'kode_publik', 'created_at'];

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');

  if (kelompok_id) {
    const perm = await getPermission(session.user.email, kelompok_id);
    if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  }

  const murid = await readSheet(SHEETS.MURID);
  const filtered = kelompok_id ? murid.filter(m => m.kelompok_id === kelompok_id) : murid;
  return NextResponse.json(filtered);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, nama_murid } = await req.json();

  // Hanya owner yang boleh tambah murid
  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa kelola murid' }, { status: 403 });

  const id = generateId();
  const kode_publik = generateKodePublik();
  await appendRow(SHEETS.MURID, [id, kelompok_id, nama_murid, kode_publik, new Date().toISOString()]);
  return NextResponse.json({ id, kelompok_id, nama_murid, kode_publik });
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, nama_murid, kelompok_id } = await req.json();

  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa edit murid' }, { status: 403 });

  const allMurid = await readSheet(SHEETS.MURID);
  const target = allMurid.find(m => m.id === id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await updateRow(SHEETS.MURID, { ...target, nama_murid }, MURID_HEADERS);
  return NextResponse.json({ success: true });
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const allMurid = await readSheet(SHEETS.MURID);
  const target = allMurid.find(m => m.id === id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const perm = await getPermission(session.user.email, target.kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa hapus murid' }, { status: 403 });

  await deleteRows(SHEETS.MURID, [target]);
  return NextResponse.json({ success: true });
}
