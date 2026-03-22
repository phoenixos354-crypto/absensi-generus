import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, SHEETS, getGoogleSheetsClient, SPREADSHEET_ID } from '@/lib/sheets';
import { NextResponse } from 'next/server';

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

  const headers = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'created_at'];
  const allRows = [headers, ...updated.map(k => [k.id, k.user_id, k.nama_kelompok, k.tingkatan, k.desa, k.daerah, k.created_at])];

  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEETS.KELOMPOK}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: allRows },
  });

  return NextResponse.json({ success: true });
}

// HAPUS kelompok beserta murid, jadwal, dan absensi terkait
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;
  const sheets = getGoogleSheetsClient();

  const [allKelompok, allMurid, allJadwal, allAbsensi] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.JADWAL),
    readSheet(SHEETS.ABSENSI),
  ]);

  const target = allKelompok.find(k => k.id === id && k.user_id === session.user.id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Hapus dari semua sheet terkait
  const writeSheet = async (sheetName, headers, rows) => {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers, ...rows] },
    });
  };

  await Promise.all([
    writeSheet(SHEETS.KELOMPOK,
      ['id','user_id','nama_kelompok','tingkatan','desa','daerah','created_at'],
      allKelompok.filter(k => k.id !== id).map(k => [k.id,k.user_id,k.nama_kelompok,k.tingkatan,k.desa,k.daerah,k.created_at])
    ),
    writeSheet(SHEETS.MURID,
      ['id','kelompok_id','nama_murid','created_at'],
      allMurid.filter(m => m.kelompok_id !== id).map(m => [m.id,m.kelompok_id,m.nama_murid,m.created_at])
    ),
    writeSheet(SHEETS.JADWAL,
      ['id','kelompok_id','hari','created_at'],
      allJadwal.filter(j => j.kelompok_id !== id).map(j => [j.id,j.kelompok_id,j.hari,j.created_at])
    ),
    writeSheet(SHEETS.ABSENSI,
      ['id','kelompok_id','murid_id','tanggal','status','dicatat_oleh','created_at'],
      allAbsensi.filter(a => a.kelompok_id !== id).map(a => [a.id,a.kelompok_id,a.murid_id,a.tanggal,a.status,a.dicatat_oleh,a.created_at])
    ),
  ]);

  return NextResponse.json({ success: true });
}
