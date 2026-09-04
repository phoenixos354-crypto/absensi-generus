import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readWhere, appendRow, deleteRows, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

// GET /api/pengeluaran-infaq?kelompok_id=xxx
// Mengembalikan semua pengeluaran infaq untuk kelompok tersebut.
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  if (!kelompok_id) return NextResponse.json({ error: 'kelompok_id wajib' }, { status: 400 });

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const rows = await readWhere(SHEETS.PENGELUARAN_INFAQ, { kelompok_id });
  const result = rows
    .map(r => ({
      id: r.id,
      kelompok_id: r.kelompok_id,
      tanggal: r.tanggal,
      keterangan: r.keterangan || '',
      jumlah: Number(r.jumlah) || 0,
      dicatat_oleh: r.dicatat_oleh,
      created_at: r.created_at,
    }))
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

  return NextResponse.json(result);
}

// POST { kelompok_id, tanggal, keterangan, jumlah }
// Menambah satu catatan pengeluaran infaq.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, tanggal, keterangan, jumlah } = await req.json();

  if (!kelompok_id || !tanggal) {
    return NextResponse.json({ error: 'kelompok_id dan tanggal wajib' }, { status: 400 });
  }

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan' }, { status: 403 });

  const jumlahNum = Number(jumlah) || 0;
  if (jumlahNum <= 0) {
    return NextResponse.json({ error: 'Jumlah pengeluaran harus lebih dari 0' }, { status: 400 });
  }

  await appendRow(SHEETS.PENGELUARAN_INFAQ, [
    generateId(), kelompok_id, tanggal, keterangan || '', jumlahNum, session.user.email, new Date().toISOString(),
  ]);

  return NextResponse.json({ success: true });
}

// DELETE { id }
// Menghapus satu catatan pengeluaran infaq berdasarkan id.
export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 });

  // Cari baris untuk dapat kelompok_id, lalu cek permission
  // Kita perlu baca semua lalu filter by id — tabel kecil, tidak masalah.
  const rows = await readWhere(SHEETS.PENGELUARAN_INFAQ, {});
  const target = rows.find(r => r.id === id);
  if (!target) return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 });

  const perm = await getPermission(session.user.email, target.kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan' }, { status: 403 });

  await deleteRows(SHEETS.PENGELUARAN_INFAQ, [target]);

  return NextResponse.json({ success: true });
}
