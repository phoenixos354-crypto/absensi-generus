import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, updateRow, SHEETS } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

const KELOMPOK_HEADERS = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];

// POST { kelompok_id, kode }
// Kelompok ikut CUSTOM TARGET kelompok lain, dengan memasukkan kode yang
// dibagikan oleh kelompok pembuatnya. Ini satu-satunya cara untuk "melihat"
// target milik kelompok lain — tidak ada lagi daftar browsing otomatis.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, kode } = await req.json();
  const kodeBersih = (kode || '').trim().toUpperCase();
  if (!kodeBersih) return NextResponse.json({ error: 'Kode wajib diisi' }, { status: 400 });

  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa ganti target' }, { status: 403 });

  const [kelompokList, semuaPreset] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.TARGET_PRESET),
  ]);

  const kelompok = kelompokList.find(k => k.id === kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 });

  const preset = semuaPreset.find(p => (p.kode || '').toUpperCase() === kodeBersih);
  if (!preset) return NextResponse.json({ error: 'Kode target tidak ditemukan. Cek lagi kodenya ya.' }, { status: 404 });

  await updateRow(SHEETS.KELOMPOK, { ...kelompok, preset_id: preset.id }, KELOMPOK_HEADERS);

  return NextResponse.json({ id: preset.id, nama_preset: preset.nama_preset, nama_kelompok_asal: preset.nama_kelompok_asal });
}
