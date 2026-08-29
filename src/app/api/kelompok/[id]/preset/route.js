import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS, getGoogleSheetsClient, SPREADSHEET_ID, invalidateSheet } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

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

  const headers = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];
  const updated = kelompokList.map(k => k.id === id ? { ...k, preset_id } : k);

  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${SHEETS.KELOMPOK}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.KELOMPOK}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers, ...updated.map(k => [k.id, k.user_id, k.nama_kelompok, k.tingkatan, k.desa, k.daerah, k.preset_id || '', k.created_at])] },
  });
  invalidateSheet(SHEETS.KELOMPOK);

  return NextResponse.json({ success: true });
}
