import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readWhere, appendRow, updateRow, deleteRows, getSupabaseClient, SHEETS, generateId, generateKodePublik } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

// Sinkron dengan HEADERS[SHEETS.MURID] di src/lib/sheets.js. sub_kelas
// SELALU paling akhir supaya urutan kolom lama tidak bergeser.
const MURID_HEADERS = ['id', 'kelompok_id', 'nama_murid', 'kode_publik', 'created_at', 'sub_kelas'];

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');

  if (kelompok_id) {
    const perm = await getPermission(session.user.email, kelompok_id);
    if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  }

  const murid = kelompok_id ? await readWhere(SHEETS.MURID, { kelompok_id }) : await readWhere(SHEETS.MURID, {});
  return NextResponse.json(murid);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, nama_murid, sub_kelas } = await req.json();

  // Hanya owner yang boleh tambah murid
  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa kelola murid' }, { status: 403 });

  const id = generateId();
  const kode_publik = generateKodePublik();
  // sub_kelas opsional (khusus caberawit) — kalau tidak dikirim, simpan '' (kosong)
  const subKelas = typeof sub_kelas === 'string' ? sub_kelas : '';
  await appendRow(SHEETS.MURID, [id, kelompok_id, nama_murid, kode_publik, new Date().toISOString(), subKelas]);
  return NextResponse.json({ id, kelompok_id, nama_murid, kode_publik, sub_kelas: subKelas });
}

export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, nama_murid, sub_kelas } = await req.json();

  const found = await readWhere(SHEETS.MURID, { id });
  const target = found[0];
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Ambil kelompok_id dari data murid yang tersimpan (bukan dari body request),
  // supaya cek izin tetap akurat walau client tidak mengirim kelompok_id.
  const perm = await getPermission(session.user.email, target.kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa edit murid' }, { status: 403 });

  // Update nama_murid (perilaku lama tetap) + sub_kelas opsional.
  // Kalau client tidak mengirim sub_kelas, pakai nilai yang sudah tersimpan
  // (murid lama yang belum punya kolom ini akan terbaca undefined -> '').
  const subKelasBaru = typeof sub_kelas === 'string'
    ? sub_kelas
    : (target.sub_kelas || '');
  await updateRow(SHEETS.MURID, { ...target, nama_murid, sub_kelas: subKelasBaru }, MURID_HEADERS);
  return NextResponse.json({ success: true, nama_murid, sub_kelas: subKelasBaru });
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const foundDel = await readWhere(SHEETS.MURID, { id });
  const target = foundDel[0];
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const perm = await getPermission(session.user.email, target.kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa hapus murid' }, { status: 403 });

  await deleteRows(SHEETS.MURID, [target]);
  return NextResponse.json({ success: true });
}
