import { google } from 'googleapis';

// =============================================
// KONEKSI KE GOOGLE SHEETS
// =============================================
export function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// =============================================
// NAMA SHEET (TAB) DI GOOGLE SHEETS
// =============================================
export const SHEETS = {
  USERS:          'users',
  KELOMPOK:       'kelompok',
  MURID:          'murid',
  JADWAL:         'jadwal',
  ABSENSI:        'absensi',
  ADMIN_KELOMPOK: 'admin_kelompok',
};

// =============================================
// HELPER: Baca semua data dari satu sheet
// =============================================
export async function readSheet(sheetName) {
  const sheets = getGoogleSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

// =============================================
// HELPER: Tulis baris baru ke sheet
// =============================================
export async function appendRow(sheetName, values) {
  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// =============================================
// HELPER: Update satu sel / range tertentu
// =============================================
export async function updateCell(sheetName, range, values) {
  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

// =============================================
// HELPER: Baca sheet lalu cari baris berdasar kolom
// =============================================
export async function findRows(sheetName, filterFn) {
  const rows = await readSheet(sheetName);
  return rows.filter(filterFn);
}

// =============================================
// HELPER: Inisiasi semua sheet jika belum ada
// =============================================
export async function initializeSheets() {
  const sheets = getGoogleSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);

  const sheetsConfig = [
    {
      name: SHEETS.USERS,
      headers: ['id', 'email', 'name', 'image', 'created_at'],
    },
    {
      name: SHEETS.KELOMPOK,
      headers: ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'created_at'],
    },
    {
      name: SHEETS.MURID,
      headers: ['id', 'kelompok_id', 'nama_murid', 'created_at'],
    },
    {
      name: SHEETS.JADWAL,
      headers: ['id', 'kelompok_id', 'hari', 'created_at'],
    },
    {
      name: SHEETS.ABSENSI,
      headers: ['id', 'kelompok_id', 'murid_id', 'tanggal', 'status', 'dicatat_oleh', 'created_at'],
    },
    {
      name: SHEETS.ADMIN_KELOMPOK,
      headers: ['id', 'kelompok_id', 'email', 'permission', 'invited_by', 'created_at'],
    },
  ];

  const requests = [];
  for (const sc of sheetsConfig) {
    if (!existingSheets.includes(sc.name)) {
      requests.push({
        addSheet: { properties: { title: sc.name } },
      });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }

  // Tulis header jika sheet baru
  for (const sc of sheetsConfig) {
    if (!existingSheets.includes(sc.name)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sc.name}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [sc.headers] },
      });
    }
  }
}

// =============================================
// HELPER: Generate ID unik sederhana
// =============================================
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
