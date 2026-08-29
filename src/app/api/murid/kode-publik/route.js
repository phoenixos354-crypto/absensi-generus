import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, updateRow, SHEETS, generateKodePublik } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

const MURID_HEADERS = ['id', 'kelompok_id', 'nama_murid', 'kode_publik', 'created_at'];

// GET /api/murid/kode-publik?murid_id=...
// Kalau murid belum punya kode_publik (data lama sebelum fitur ini ada),
// otomatis dibuatkan & disimpan sekali di sini.
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const murid_id = searchParams.get('murid_id');

  const allMurid = await readSheet(SHEETS.MURID);
  const murid = allMurid.find(m => m.id === murid_id);
  if (!murid) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const perm = await getPermission(session.user.email, murid.kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  if (murid.kode_publik) return NextResponse.json({ kode_publik: murid.kode_publik });

  const kode_publik = generateKodePublik();
  await updateRow(SHEETS.MURID, { ...murid, kode_publik }, MURID_HEADERS);

  return NextResponse.json({ kode_publik });
}
