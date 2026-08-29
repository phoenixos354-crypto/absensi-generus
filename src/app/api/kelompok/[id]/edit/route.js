import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS, getGoogleSheetsClient, SPREADSHEET_ID, invalidateSheet } from '@/lib/sheets';
import { NextResponse } from 'next/server';

// Helper tulis ulang sheet — sequential bukan parallel untuk hindari race condition
async function tulisSheet(sheets, sheetName, headers, rows) {
  // Clear dulu seluruh sheet, baru tulis ulang
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  if (rows.length === 0) {
    // Tulis header saja
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers, ...rows] },
    });
  }
}

// EDIT kelompok
export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const { nama_kelompok, tingkatan, desa, daerah } = await req.json();

  const allKelompok = await readSheet(SHEETS.KELOMPOK);
  const target = allKelompok.find(k => k.id === id && k.user_id === session.user.id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = allKelompok.map(k =>
    k.id === id ? { ...k, nama_kelompok, tingkatan, desa, daerah } : k
  );

  const sheets = getGoogleSheetsClient();
  await tulisSheet(
    sheets,
    SHEETS.KELOMPOK,
    ['id','user_id','nama_kelompok','tingkatan','desa','daerah','preset_id','created_at'],
    updated.map(k => [k.id,k.user_id,k.nama_kelompok,k.tingkatan,k.desa,k.daerah,k.preset_id || '',k.created_at])
  );
  invalidateSheet(SHEETS.KELOMPOK);

  return NextResponse.json({ success: true });
}

// HAPUS kelompok — sequential untuk hindari race condition
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const sheets = getGoogleSheetsClient();

  const [allKelompok, allMurid, allJadwal, allAbsensi, allAdmin] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.JADWAL),
    readSheet(SHEETS.ABSENSI),
    readSheet(SHEETS.ADMIN_KELOMPOK),
  ]);

  const target = allKelompok.find(k => k.id === id && k.user_id === session.user.id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Hapus sequential — satu per satu agar tidak race condition di Google Sheets
  await tulisSheet(sheets, SHEETS.KELOMPOK,
    ['id','user_id','nama_kelompok','tingkatan','desa','daerah','preset_id','created_at'],
    allKelompok.filter(k => k.id !== id).map(k => [k.id,k.user_id,k.nama_kelompok,k.tingkatan,k.desa,k.daerah,k.preset_id || '',k.created_at])
  );

  await tulisSheet(sheets, SHEETS.MURID,
    ['id','kelompok_id','nama_murid','kode_publik','created_at'],
    allMurid.filter(m => m.kelompok_id !== id).map(m => [m.id,m.kelompok_id,m.nama_murid,m.kode_publik || '',m.created_at])
  );

  await tulisSheet(sheets, SHEETS.JADWAL,
    ['id','kelompok_id','hari','created_at'],
    allJadwal.filter(j => j.kelompok_id !== id).map(j => [j.id,j.kelompok_id,j.hari,j.created_at])
  );

  await tulisSheet(sheets, SHEETS.ABSENSI,
    ['id','kelompok_id','murid_id','tanggal','status','dicatat_oleh','created_at'],
    allAbsensi.filter(a => a.kelompok_id !== id).map(a => [a.id,a.kelompok_id,a.murid_id,a.tanggal,a.status,a.dicatat_oleh,a.created_at])
  );

  await tulisSheet(sheets, SHEETS.ADMIN_KELOMPOK,
    ['id','kelompok_id','email','permission','invited_by','created_at'],
    allAdmin.filter(a => a.kelompok_id !== id).map(a => [a.id,a.kelompok_id,a.email,a.permission,a.invited_by,a.created_at])
  );

  invalidateSheet(SHEETS.KELOMPOK);
  invalidateSheet(SHEETS.MURID);
  invalidateSheet(SHEETS.JADWAL);
  invalidateSheet(SHEETS.ABSENSI);
  invalidateSheet(SHEETS.ADMIN_KELOMPOK);

  return NextResponse.json({ success: true });
}
