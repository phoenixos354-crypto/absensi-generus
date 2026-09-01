import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, updateRow, deleteRows, SHEETS } from '@/lib/sheets';
import { NextResponse } from 'next/server';

const JAMAAH_HEADERS = ['id', 'kelompok_id', 'nama', 'umur', 'jenis_kelamin', 'status_pernikahan', 'kategori_usia', 'status_keluarga', 'kepala_keluarga_id', 'created_at'];

async function ambilJamaahMilikUser(id, userId) {
  const [jamaahList, kelompokList] = await Promise.all([
    readSheet(SHEETS.JAMAAH),
    readSheet(SHEETS.KELOMPOK_JAMAAH),
  ]);
  const jamaah = jamaahList.find(j => j.id === id);
  if (!jamaah) return { jamaah: null, kelompok: null };
  const kelompok = kelompokList.find(k => k.id === jamaah.kelompok_id);
  if (!kelompok || kelompok.user_id !== userId) return { jamaah: null, kelompok: null };
  return { jamaah, kelompok };
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jamaah } = await ambilJamaahMilikUser(params.id, session.user.id);
  if (!jamaah) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });

  const body = await req.json();
  const { nama, umur, jenis_kelamin, status_pernikahan, kategori_usia, status_keluarga } = body;
  let kepala_keluarga_id = body.kepala_keluarga_id || '';

  if (status_keluarga !== 'anggota_keluarga') {
    kepala_keluarga_id = '';
  } else if (kepala_keluarga_id) {
    const jamaahList = await readSheet(SHEETS.JAMAAH);
    const kk = jamaahList.find(j => j.id === kepala_keluarga_id && j.kelompok_id === jamaah.kelompok_id);
    if (!kk || kk.status_keluarga !== 'kepala_keluarga') {
      return NextResponse.json({ error: 'Kepala keluarga yang dipilih tidak valid' }, { status: 400 });
    }
    if (kepala_keluarga_id === jamaah.id) {
      return NextResponse.json({ error: 'Tidak bisa memilih diri sendiri sebagai kepala keluarga' }, { status: 400 });
    }
  }

  await updateRow(SHEETS.JAMAAH, {
    ...jamaah, nama, umur: umur || '', jenis_kelamin: jenis_kelamin || '',
    status_pernikahan: status_pernikahan || '', kategori_usia: kategori_usia || '',
    status_keluarga: status_keluarga || '', kepala_keluarga_id,
  }, JAMAAH_HEADERS);

  return NextResponse.json({ success: true });
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jamaah } = await ambilJamaahMilikUser(params.id, session.user.id);
  if (!jamaah) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });

  // Kalau dia kepala keluarga dan masih ada anggota yang ikut dia, jangan
  // langsung dihapus begitu saja — supaya anggota keluarga tidak nyangkut
  // ke KK yang sudah tidak ada. Minta pengguna alihkan/hapus dulu anggotanya.
  if (jamaah.status_keluarga === 'kepala_keluarga') {
    const jamaahList = await readSheet(SHEETS.JAMAAH);
    const adaAnggota = jamaahList.some(j => j.kepala_keluarga_id === jamaah.id);
    if (adaAnggota) {
      return NextResponse.json(
        { error: 'Masih ada anggota keluarga yang mengikuti KK ini. Alihkan atau hapus anggotanya dulu.' },
        { status: 400 }
      );
    }
  }

  await deleteRows(SHEETS.JAMAAH, [jamaah]);
  return NextResponse.json({ success: true });
}
