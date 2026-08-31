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
// HELPER: Coba ulang otomatis kalau kena error SEMENTARA dari Google
// (rate limit / server lagi sibuk). Ini penting terutama saat banyak
// kelompok/admin buka Rekap-Target-Kelola-Admin bersamaan — tanpa ini,
// satu kali kena rate limit langsung bikin halaman gagal dan user
// dilempar balik ke dashboard. Delay-nya naik tiap percobaan (backoff).
// =============================================
async function withRetry(fn, { retries = 3, baseDelayMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.code || err?.response?.status;
      const bisaDiulang = status === 429 || (status >= 500 && status < 600);
      if (!bisaDiulang || attempt === retries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

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
    const res = await withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    }));
    const rows = res.data.values || [];
    // _row = nomor baris ASLI di sheet (1 = header, jadi data mulai baris 2).
    // Dipakai supaya update/hapus bisa langsung ke baris itu saja, tanpa
    // perlu baca-hapus-tulis ulang seluruh sheet. Properti ini ikut terbawa
    // kalau kode lain nge-spread object-nya ({ ...row, field: baru }).
    const data = rows.length < 2 ? [] : rows.slice(1).map((row, idx) => {
      const obj = { _row: idx + 2 };
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
// HELPER: Tulis BANYAK baris sekaligus dalam SATU request
// (penting: appendRow satu-satu berkali-kali gampang kena rate limit
// Google Sheets API — selalu pakai ini kalau nulis > 1 baris sekaligus)
// =============================================
export async function appendRows(sheetName, rowsArray) {
  if (!rowsArray || rowsArray.length === 0) return;
  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rowsArray },
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
// HELPER: Pastikan sebuah sheet punya kolom header tertentu.
// Dipakai kalau ada fitur baru yang butuh kolom baru (mis. "kelas" di
// target_item), tapi sheet-nya sudah lama ada di spreadsheet user dan
// belum punya kolom itu. Kalau header belum ada, otomatis ditambahkan
// di kolom paling kanan (sekali saja, aman dipanggil berkali-kali).
// Return: nama huruf kolom tempat header itu berada (mis. "H").
// =============================================
const _headerColCache = new Map(); // `${sheetName}:${headerName}` -> huruf kolom
function angkaKeKolom(idxNolBasis) {
  // 0 -> A, 25 -> Z, 26 -> AA, dst.
  let n = idxNolBasis + 1;
  let hasil = '';
  while (n > 0) {
    const sisa = (n - 1) % 26;
    hasil = String.fromCharCode(65 + sisa) + hasil;
    n = Math.floor((n - 1) / 26);
  }
  return hasil;
}
export async function ensureHeaderColumn(sheetName, headerName) {
  const cacheKey = `${sheetName}:${headerName}`;
  if (_headerColCache.has(cacheKey)) return _headerColCache.get(cacheKey);

  const sheets = getGoogleSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const headers = res.data.values?.[0] || [];
  const idxAda = headers.indexOf(headerName);
  if (idxAda !== -1) {
    const kolom = angkaKeKolom(idxAda);
    _headerColCache.set(cacheKey, kolom);
    return kolom;
  }

  const kolomBaru = angkaKeKolom(headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${kolomBaru}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[headerName]] },
  });
  invalidateSheet(sheetName);
  _headerColCache.set(cacheKey, kolomBaru);
  return kolomBaru;
}

// =============================================
// HELPER: Update SATU baris spesifik (pakai nomor baris dari _row)
// Jauh lebih cepat daripada clear+rewrite seluruh sheet — cocok untuk
// edit 1 record (misal: ganti nama murid, ganti preset_id kelompok).
// `row` harus punya properti _row (otomatis ada kalau berasal dari readSheet).
// =============================================
export async function updateRow(sheetName, row, headers) {
  if (!row?._row) throw new Error(`updateRow: baris tidak punya _row (sheet: ${sheetName})`);
  const sheets = getGoogleSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${row._row}:${String.fromCharCode(64 + headers.length)}${row._row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers.map(h => row[h] ?? '')] },
  });
  invalidateSheet(sheetName);
}

// =============================================
// HELPER: cache sheetId (angka internal Google, beda dari nama sheet)
// dibutuhkan khusus untuk operasi hapus baris (deleteDimension).
// =============================================
const _sheetIdCache = new Map();
async function getSheetIdByName(sheets, sheetName) {
  if (_sheetIdCache.has(sheetName)) return _sheetIdCache.get(sheetName);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  for (const s of meta.data.sheets) {
    _sheetIdCache.set(s.properties.title, s.properties.sheetId);
  }
  return _sheetIdCache.get(sheetName);
}

// =============================================
// HELPER: Hapus baris-baris SPESIFIK (pakai nomor baris dari _row)
// Jauh lebih cepat & aman daripada clear+rewrite seluruh sheet —
// cocok untuk hapus 1 atau beberapa record sekaligus.
// `rows` = array of object yang punya _row (dari readSheet).
// =============================================
export async function deleteRows(sheetName, rows) {
  if (!rows || rows.length === 0) return;
  const sheets = getGoogleSheetsClient();
  const sheetId = await getSheetIdByName(sheets, sheetName);
  // Urutkan dari nomor baris TERBESAR ke terkecil — supaya penghapusan
  // baris atas tidak menggeser nomor baris bawah yang belum diproses
  // dalam batch request yang sama.
  const rowNumbers = [...new Set(rows.map(r => r._row))].sort((a, b) => b - a);
  const requests = rowNumbers.map(rowNum => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: rowNum - 1, // 0-indexed
        endIndex: rowNum,
      },
    },
  }));
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
  invalidateSheet(sheetName);
}

// =============================================
// HELPER: untuk tabel "append-only" (absensi, target_progress, sesi) —
// tiap perubahan cuma NAMBAH baris baru, tidak pernah hapus/timpa baris
// lama. Baca-nya tinggal ambil baris TERAKHIR per kunci (kunci ditentukan
// oleh keyFn), karena baris yang lebih baru selalu ditambahkan di bawah,
// jadi otomatis "menang" menimpa nilai lama di Map.
// =============================================
export async function readLatestByKey(sheetName, keyFn) {
  const rows = await readSheet(sheetName);
  const map = new Map();
  for (const row of rows) map.set(keyFn(row), row);
  return [...map.values()];
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
      headers: ['id', 'preset_id', 'tingkatan', 'kategori', 'urutan', 'nama_item', 'created_at', 'kelas'],
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
  // Pakai batchGet (1 request) supaya gak baca sheet satu-satu tiap dashboard dibuka.
  const sheetLama = sheetsConfig.filter(sc => existingSheets.includes(sc.name));
  if (sheetLama.length > 0) {
    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: sheetLama.map(sc => `${sc.name}!1:1`),
    });
    const updateRequests = [];
    sheetLama.forEach((sc, idx) => {
      const currentHeaders = batchRes.data.valueRanges?.[idx]?.values?.[0] || [];
      const missing = sc.headers.filter(h => !currentHeaders.includes(h));
      if (missing.length > 0) {
        updateRequests.push({
          range: `${sc.name}!A1`,
          values: [[...currentHeaders, ...missing]],
        });
        invalidateSheet(sc.name);
      }
    });
    if (updateRequests.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: updateRequests },
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
