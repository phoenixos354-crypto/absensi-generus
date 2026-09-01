import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId } from '@/lib/sheets';
import { NextResponse } from 'next/server';

async function cekPemilikKelompok(kelompokId, userId) {
  const kelompokList = await readSheet(SHEETS.KELOMPOK_JAMAAH);
  const kelompok = kelompokList.find(k => k.id === kelompokId);
  return kelompok && kelompok.user_id === userId ? kelompok : null;
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  if (!kelompok_id) return NextResponse.json({ error: 'kelompok_id wajib diisi' }, { status: 400 });

  const kelompok = await cekPemilikKelompok(kelompok_id, session.user.id);
  if (!kelompok) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const jamaahList = await readSheet(SHEETS.JAMAAH);
  return NextResponse.json(jamaahList.filter(j => j.kelompok_id === kelompok_id));
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { kelompok_id, nama, umur, jenis_kelamin, status_pernikahan, kategori_usia, status_keluarga } = body;
  let kepala_keluarga_id = body.kepala_keluarga_id || '';

  if (!kelompok_id || !nama) return NextResponse.json({ error: 'Data belum lengkap' }, { status: 400 });

  const kelompok = await cekPemilikKelompok(kelompok_id, session.user.id);
  if (!kelompok) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  // Kalau bukan "anggota_keluarga", kepala_keluarga_id tidak relevan —
  // jangan sampai kesimpan nyangkut dari input sebelumnya.
  if (status_keluarga !== 'anggota_keluarga') {
    kepala_keluarga_id = '';
  } else if (kepala_keluarga_id) {
    // Validasi: kepala keluarga yang dipilih harus benar ada di kelompok
    // yang sama dan statusnya memang kepala_keluarga.
    const jamaahList = await readSheet(SHEETS.JAMAAH);
    const kk = jamaahList.find(j => j.id === kepala_keluarga_id && j.kelompok_id === kelompok_id);
    if (!kk || kk.status_keluarga !== 'kepala_keluarga') {
      return NextResponse.json({ error: 'Kepala keluarga yang dipilih tidak valid' }, { status: 400 });
    }
  }

  const id = generateId();
  await appendRow(SHEETS.JAMAAH, [
    id, kelompok_id, nama, umur || '', jenis_kelamin || '', status_pernikahan || '',
    kategori_usia || '', status_keluarga || '', kepala_keluarga_id, new Date().toISOString(),
  ]);

  return NextResponse.json({ id, kelompok_id, nama });
}
