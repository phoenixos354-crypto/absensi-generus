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
// CACHE SEMENTARA DI MEMORI SERVER
// Google Sheets API cukup lambat, jadi tiap sheet yang baru saja dibaca
// disimpan sebentar (TTL) supaya request-request berikutnya (dalam waktu
// dekat, termasuk beberapa request paralel di request yang sama) tidak
// perlu bolak-balik ke Google lagi. Begitu ada tulis (appendRow/updateCell/
// invalidateSheet manual), cache untuk sheet itu langsung dibuang supaya
// data yang dibaca berikutnya tetap segar.
// =============================================
const CACHE_TTL_MS = 20_000; // 20 detik
const _sheetCache = new Map(); // sheetName -> { data, expiry }
const _inFlight = new Map();   // sheetName -> Promise (biar request paralel numpang satu fetch saja)

export function invalidateSheet(sheetName) {
  _sheetCache.delete(sheetName);
  _inFlight.delete(sheetName);
}

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
  DALIL:          'dalil_harian',
  SESI:           'sesi',
  TARGET_PRESET:  'target_preset',
  TARGET_ITEM:    'target_item',
  TARGET_PROGRESS:'target_progress',
};

// =============================================
// HELPER: Baca semua data dari satu sheet
// =============================================
export async function readSheet(sheetName, { skipCache = false } = {}) {
  const cached = _sheetCache.get(sheetName);
  if (!skipCache && cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  // Kalau ada request lain yang sedang baca sheet yang sama, numpang
  // hasilnya saja daripada nembak Google Sheets dua kali bersamaan.
  if (!skipCache && _inFlight.has(sheetName)) {
    return _inFlight.get(sheetName);
  }

  const fetchPromise = (async () => {
    const sheets = getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });
    const rows = res.data.values || [];
    const data = rows.length < 2 ? [] : rows.slice(1).map(row => {
      const obj = {};
      rows[0].forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
    _sheetCache.set(sheetName, { data, expiry: Date.now() + CACHE_TTL_MS });
    _inFlight.delete(sheetName);
    return data;
  })();

  _inFlight.set(sheetName, fetchPromise);
  return fetchPromise;
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
  invalidateSheet(sheetName);
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
  invalidateSheet(sheetName);
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
      headers: ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'],
    },
    {
      name: SHEETS.MURID,
      headers: ['id', 'kelompok_id', 'nama_murid', 'kode_publik', 'created_at'],
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
    {
      name: SHEETS.DALIL,
      headers: ['id', 'tanggal', 'tipe', 'teks_arab', 'teks_terjemah', 'sumber', 'mascot_index', 'created_at'],
    },
    {
      name: SHEETS.SESI,
      headers: ['id', 'kelompok_id', 'tanggal', 'jurnal', 'infaq', 'dicatat_oleh', 'created_at'],
    },
    {
      // Preset target = kumpulan materi bernama, bisa dibuat siapa saja & diikuti kelompok lain.
      // preset_id 'default' itu preset bawaan (virtual, tidak perlu baris di sini).
      name: SHEETS.TARGET_PRESET,
      headers: ['id', 'nama_preset', 'dibuat_oleh_kelompok_id', 'nama_kelompok_asal', 'desa_asal', 'daerah_asal', 'dibuat_oleh_email', 'created_at'],
    },
    {
      // Item target per preset. preset_id='default' + tingkatan + kategori = daftar bawaan (dummy).
      name: SHEETS.TARGET_ITEM,
      headers: ['id', 'preset_id', 'tingkatan', 'kategori', 'urutan', 'nama_item', 'created_at'],
    },
    {
      // Progress per murid per item. Tidak ada baris = otomatis dianggap 'belum'.
      name: SHEETS.TARGET_PROGRESS,
      headers: ['id', 'murid_id', 'item_id', 'nilai', 'tanggal', 'dicatat_oleh', 'created_at'],
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

  // Migrasi: sheet yang SUDAH ada tapi belum punya kolom baru (mis. preset_id,
  // kode_publik) -> tambahkan nama kolomnya di akhir header, tanpa sentuh data lama.
  for (const sc of sheetsConfig) {
    if (!existingSheets.includes(sc.name)) continue;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sc.name}!1:1`,
    });
    const currentHeaders = res.data.values?.[0] || [];
    const missing = sc.headers.filter(h => !currentHeaders.includes(h));
    if (missing.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sc.name}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[...currentHeaders, ...missing]] },
      });
      invalidateSheet(sc.name);
    }
  }
}

// =============================================
// HELPER: Generate ID unik sederhana
// =============================================
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// =============================================
// HELPER: Kode publik pendek buat link "kartu anak" (dilihat orang tua)
// Sengaja gak pakai angka urut biar gak gampang ditebak orang lain.
// =============================================
export function generateKodePublik() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I biar gak ketuker
  let kode = '';
  for (let i = 0; i < 8; i++) kode += chars[Math.floor(Math.random() * chars.length)];
  return kode;
}
