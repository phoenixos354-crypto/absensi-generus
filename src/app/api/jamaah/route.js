import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId } from '@/lib/sheets';
import { NextResponse } from 'next/server';

async function cekPemilikWilayah(wilayahId, userId) {
  const wilayahList = await readSheet(SHEETS.WILAYAH_JAMAAH);
  const wilayah = wilayahList.find(w => w.id === wilayahId);
  return wilayah && wilayah.user_id === userId ? wilayah : null;
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const wilayah_id = searchParams.get('wilayah_id');
  if (!wilayah_id) return NextResponse.json({ error: 'wilayah_id wajib diisi' }, { status: 400 });

  const wilayah = await cekPemilikWilayah(wilayah_id, session.user.id);
  if (!wilayah) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const jamaahList = await readSheet(SHEETS.JAMAAH);
  return NextResponse.json(jamaahList.filter(j => j.wilayah_id === wilayah_id));
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { wilayah_id, nama, umur, jenis_kelamin, status_pernikahan, kategori_usia, status_keluarga } = body;
  let kepala_keluarga_id = body.kepala_keluarga_id || '';

  if (!wilayah_id || !nama) return NextResponse.json({ error: 'Data belum lengkap' }, { status: 400 });

  const wilayah = await cekPemilikWilayah(wilayah_id, session.user.id);
  if (!wilayah) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  // Kalau bukan "anggota_keluarga", kepala_keluarga_id tidak relevan —
  // jangan sampai kesimpan nyangkut dari input sebelumnya.
  if (status_keluarga !== 'anggota_keluarga') {
    kepala_keluarga_id = '';
  } else if (kepala_keluarga_id) {
    // Validasi: kepala keluarga yang dipilih harus benar ada di wilayah
    // yang sama dan statusnya memang kepala_keluarga.
    const jamaahList = await readSheet(SHEETS.JAMAAH);
    const kk = jamaahList.find(j => j.id === kepala_keluarga_id && j.wilayah_id === wilayah_id);
    if (!kk || kk.status_keluarga !== 'kepala_keluarga') {
      return NextResponse.json({ error: 'Kepala keluarga yang dipilih tidak valid' }, { status: 400 });
    }
  }

  const id = generateId();
  await appendRow(SHEETS.JAMAAH, [
    id, wilayah_id, nama, umur || '', jenis_kelamin || '', status_pernikahan || '',
    kategori_usia || '', status_keluarga || '', kepala_keluarga_id, new Date().toISOString(),
  ]);

  return NextResponse.json({ id, wilayah_id, nama });
}
