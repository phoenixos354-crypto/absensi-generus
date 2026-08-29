import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, updateRow, SHEETS } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

export const KELOMPOK_HEADERS = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];

// PATCH { preset_id }  -> kelompok ikut preset yang sudah ada (tanpa duplikasi)
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const { preset_id } = await req.json();

  const perm = await getPermission(session.user.email, id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa ganti target' }, { status: 403 });

  const kelompokList = await readSheet(SHEETS.KELOMPOK);
  const target = kelompokList.find(k => k.id === id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await updateRow(SHEETS.KELOMPOK, { ...target, preset_id }, KELOMPOK_HEADERS);

  return NextResponse.json({ success: true });
}
