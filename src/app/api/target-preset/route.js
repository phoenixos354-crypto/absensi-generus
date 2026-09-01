import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, appendRows, updateRow, SHEETS, generateId, generateKodePublik } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { resolvePresetId, DEFAULT_PRESET_ID } from '@/lib/target';
import { NextResponse } from 'next/server';

const KELOMPOK_HEADERS = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];

// GET /api/target-preset?kelompok_id=...
// Info target yang LAGI DIIKUTI kelompok ini saja (bukan daftar browsing —
// target lain cuma bisa diikuti kalau tau kodenya, lewat POST /ikuti).
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  if (!kelompok_id) return NextResponse.json({ error: 'kelompok_id wajib diisi' }, { status: 400 });

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const kelompokList = await readSheet(SHEETS.KELOMPOK);
  const kelompok = kelompokList.find(k => k.id === kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 });

  const presetId = resolvePresetId(kelompok);

  if (presetId === DEFAULT_PRESET_ID) {
    return NextResponse.json({
      id: DEFAULT_PRESET_ID, nama_preset: 'Target Default', is_default: true,
      milik_sendiri: false, kode: null, nama_kelompok_asal: null,
    });
  }

  const semuaPreset = await readSheet(SHEETS.TARGET_PRESET);
  const preset = semuaPreset.find(p => p.id === presetId);
  if (!preset) {
    // preset_id di kelompok nunjuk ke preset yang sudah tidak ada -> anggap balik ke default
    return NextResponse.json({
      id: DEFAULT_PRESET_ID, nama_preset: 'Target Default', is_default: true,
      milik_sendiri: false, kode: null, nama_kelompok_asal: null,
    });
  }

  return NextResponse.json({
    id: preset.id,
    nama_preset: preset.nama_preset,
    is_default: false,
    milik_sendiri: preset.dibuat_oleh_kelompok_id === kelompok_id,
    kode: preset.kode || null,
    nama_kelompok_asal: preset.nama_kelompok_asal || null,
  });
}

// POST { kelompok_id, nama_preset }
// Bikin CUSTOM TARGET baru secara eksplisit (bukan auto-fork diam-diam).
// Isinya dimulai dari salinan target yang LAGI diikuti kelompok ini sekarang
// (bisa Target Default, bisa custom target lain), lalu dapat kode unik
// sendiri yang bisa dibagikan ke kelompok lain.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, nama_preset } = await req.json();
  if (!nama_preset?.trim()) return NextResponse.json({ error: 'Nama target wajib diisi' }, { status: 400 });

  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa membuat custom target' }, { status: 403 });

  const kelompokList = await readSheet(SHEETS.KELOMPOK);
  const kelompok = kelompokList.find(k => k.id === kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 });

  const sourcePresetId = resolvePresetId(kelompok);
  const newPresetId = generateId();
  const kode = generateKodePublik();

  await appendRow(SHEETS.TARGET_PRESET, [
    newPresetId, nama_preset.trim(), kelompok_id,
    kelompok.nama_kelompok, kelompok.desa, kelompok.daerah, session.user.email, new Date().toISOString(), kode,
  ]);

  // Duplikat semua item dari target yang lagi diikuti sekarang ke custom target baru
  const semuaItem = await readSheet(SHEETS.TARGET_ITEM);
  const itemSumber = semuaItem.filter(i => i.preset_id === sourcePresetId);
  if (itemSumber.length > 0) {
    await appendRows(SHEETS.TARGET_ITEM, itemSumber.map(item => [
      generateId(), newPresetId, item.tingkatan, item.kategori, item.urutan, item.nama_item, new Date().toISOString(), item.kelas || '',
    ]));
  }

  // Pindahkan kelompok ke custom target barunya sendiri
  await updateRow(SHEETS.KELOMPOK, { ...kelompok, preset_id: newPresetId }, KELOMPOK_HEADERS);

  return NextResponse.json({ id: newPresetId, nama_preset: nama_preset.trim(), kode });
}
