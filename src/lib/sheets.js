import { createClient } from '@supabase/supabase-js';

// =============================================
// KONEKSI KE SUPABASE
// Menggantikan Google Sheets. Pakai SERVICE ROLE KEY (bukan anon key)
// karena semua pemanggilan fungsi di file ini selalu terjadi di server
// (API routes Next.js), bukan langsung dari browser — jadi levelnya
// sama seperti dulu pakai Google service account: dipercaya penuh,
// pengecekan akses (owner/admin/dst) tetap dilakukan di level API
// route lewat src/lib/permission.js seperti sebelumnya.
// =============================================
let _client = null;
export function getSupabaseClient() {
  if (_client) return _client;
  _client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return _client;
}

// =============================================
// CACHE SEMENTARA DI MEMORI SERVER
// Supabase/Postgres jauh lebih tahan banting dibanding Google Sheets
// API soal rate limit, tapi cache singkat ini tetap dipertahankan
// supaya beberapa request paralel (mis. buka dashboard = banyak
// endpoint ke-hit sekaligus) tidak bolak-balik query yang sama persis.
// =============================================
const CACHE_TTL_MS = 5_000; // 5 detik — lebih pendek dari sebelumnya (20 detik)
                             // karena Postgres murah untuk dibaca ulang & data
                             // absensi harus terasa real-time.
const _sheetCache = new Map(); // sheetName -> { data, expiry }
const _inFlight = new Map();   // sheetName -> Promise

export function invalidateSheet(sheetName) {
  _sheetCache.delete(sheetName);
  _inFlight.delete(sheetName);
}

// =============================================
// NAMA TABEL DI SUPABASE (sama persis dengan nama sheet/tab dulu)
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

// Urutan kolom per tabel — dipakai untuk memetakan array `values`
// (dari appendRow/appendRows, format lama ala Google Sheets) ke nama
// kolom Supabase. Harus sinkron dengan supabase/schema.sql.
const HEADERS = {
  [SHEETS.USERS]:           ['id', 'email', 'name', 'image', 'created_at'],
  [SHEETS.KELOMPOK]:        ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'],
  [SHEETS.MURID]:           ['id', 'kelompok_id', 'nama_murid', 'kode_publik', 'created_at'],
  [SHEETS.JADWAL]:          ['id', 'kelompok_id', 'hari', 'created_at'],
  [SHEETS.ABSENSI]:         ['id', 'kelompok_id', 'murid_id', 'tanggal', 'status', 'dicatat_oleh', 'created_at'],
  [SHEETS.ADMIN_KELOMPOK]:  ['id', 'kelompok_id', 'email', 'permission', 'invited_by', 'created_at'],
  [SHEETS.DALIL]:           ['id', 'tanggal', 'tipe', 'teks_arab', 'teks_terjemah', 'sumber', 'mascot_index', 'created_at'],
  [SHEETS.SESI]:            ['id', 'kelompok_id', 'tanggal', 'jurnal', 'infaq', 'dicatat_oleh', 'created_at'],
  [SHEETS.TARGET_PRESET]:   ['id', 'nama_preset', 'dibuat_oleh_kelompok_id', 'nama_kelompok_asal', 'desa_asal', 'daerah_asal', 'dibuat_oleh_email', 'created_at'],
  [SHEETS.TARGET_ITEM]:     ['id', 'preset_id', 'tingkatan', 'kategori', 'urutan', 'nama_item', 'created_at', 'kelas'],
  [SHEETS.TARGET_PROGRESS]: ['id', 'murid_id', 'item_id', 'nilai', 'tanggal', 'dicatat_oleh', 'created_at'],
};

// =============================================
// HELPER: Coba ulang otomatis kalau kena error SEMENTARA (network
// blip, database lagi restart/scaling, dsb).
// =============================================
async function withRetry(fn, { retries = 3, baseDelayMs = 300 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 150;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function throwIfError({ data, error }) {
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data;
}

// =============================================
// HELPER: Baca semua baris dari satu tabel
// (menggantikan readSheet Google Sheets — nama & bentuk hasil SAMA:
// array of object, satu object per baris)
// =============================================
export async function readSheet(sheetName, { skipCache = false } = {}) {
  const cached = _sheetCache.get(sheetName);
  if (!skipCache && cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  if (!skipCache && _inFlight.has(sheetName)) {
    return _inFlight.get(sheetName);
  }

  const fetchPromise = (async () => {
    const headers = HEADERS[sheetName];
    if (!headers) throw new Error(`readSheet: tabel tidak dikenal: ${sheetName}`);
    const supabase = getSupabaseClient();
    const result = await withRetry(() =>
      supabase.from(sheetName).select(headers.join(',')).order('_seq', { ascending: true })
    );
    const data = throwIfError(result) || [];
    _sheetCache.set(sheetName, { data, expiry: Date.now() + CACHE_TTL_MS });
    _inFlight.delete(sheetName);
    return data;
  })();

  _inFlight.set(sheetName, fetchPromise);
  return fetchPromise;
}

// =============================================
// HELPER: Tulis baris baru (array nilai, urutan sesuai HEADERS)
// =============================================
export async function appendRow(sheetName, values) {
  const headers = HEADERS[sheetName];
  if (!headers) throw new Error(`appendRow: tabel tidak dikenal: ${sheetName}`);
  const row = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  const supabase = getSupabaseClient();
  throwIfError(await withRetry(() => supabase.from(sheetName).insert(row)));
  invalidateSheet(sheetName);
}

// =============================================
// HELPER: Tulis BANYAK baris sekaligus
// =============================================
export async function appendRows(sheetName, rowsArray) {
  if (!rowsArray || rowsArray.length === 0) return;
  const headers = HEADERS[sheetName];
  if (!headers) throw new Error(`appendRows: tabel tidak dikenal: ${sheetName}`);
  const rows = rowsArray.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
  const supabase = getSupabaseClient();
  throwIfError(await withRetry(() => supabase.from(sheetName).insert(rows)));
  invalidateSheet(sheetName);
}

// =============================================
// HELPER: Pastikan sebuah tabel punya kolom tertentu.
// Dulu perlu (Google Sheets kolom bisa nambah sendiri kalau belum
// ada). Di Supabase, semua kolom sudah didefinisikan lewat
// supabase/schema.sql, jadi ini otomatis no-op — dibiarkan ada
// supaya kode pemanggilnya (target-item/route.js) tidak perlu diubah.
// =============================================
export async function ensureHeaderColumn(_sheetName, _headerName) {
  return null;
}

// =============================================
// HELPER: Update SATU baris spesifik (pakai `id`, menggantikan
// `_row` ala nomor baris Google Sheets). `row` harus punya `id`
// (otomatis ada karena semua baris dari readSheet punya `id`).
// =============================================
export async function updateRow(sheetName, row, headers) {
  if (!row?.id) throw new Error(`updateRow: baris tidak punya id (tabel: ${sheetName})`);
  const cols = headers || HEADERS[sheetName];
  const patch = Object.fromEntries(cols.filter(h => h !== 'id').map(h => [h, row[h] ?? '']));
  const supabase = getSupabaseClient();
  throwIfError(await withRetry(() => supabase.from(sheetName).update(patch).eq('id', row.id)));
  invalidateSheet(sheetName);
}

// =============================================
// HELPER: Hapus baris-baris SPESIFIK (pakai `id` dari tiap row)
// =============================================
export async function deleteRows(sheetName, rows) {
  if (!rows || rows.length === 0) return;
  const ids = [...new Set(rows.map(r => r.id))];
  const supabase = getSupabaseClient();
  throwIfError(await withRetry(() => supabase.from(sheetName).delete().in('id', ids)));
  invalidateSheet(sheetName);
}

// =============================================
// HELPER: Hapus semua baris yang cocok dengan kolom tertentu,
// tanpa perlu baca dulu (dipakai buat "hapus semua jadwal lama
// punya kelompok X" sebelum tulis jadwal baru).
// =============================================
export async function deleteWhere(sheetName, matchObj) {
  const supabase = getSupabaseClient();
  throwIfError(await withRetry(() => supabase.from(sheetName).delete().match(matchObj)));
  invalidateSheet(sheetName);
}

// =============================================
// HELPER: untuk tabel "append-only" (absensi, target_progress, sesi)
// — baca baris TERAKHIR per kunci (keyFn), karena data terbaru selalu
// "menang" menimpa nilai lama secara logis (walau baris lama tetap
// ada di tabel sebagai riwayat).
// =============================================
export async function readLatestByKey(sheetName, keyFn) {
  const rows = await readSheet(sheetName);
  const map = new Map();
  for (const row of rows) map.set(keyFn(row), row);
  return [...map.values()];
}

// =============================================
// HELPER: Baca tabel lalu cari baris berdasar kolom
// =============================================
export async function findRows(sheetName, filterFn) {
  const rows = await readSheet(sheetName);
  return rows.filter(filterFn);
}

// =============================================
// HELPER: Dulu untuk bikin semua sheet Google kalau belum ada.
// Sekarang tabel dibuat sekali lewat supabase/schema.sql, jadi ini
// tinggal ngecek koneksi hidup — dibiarkan ada supaya /api/init tidak
// perlu diubah.
// =============================================
export async function initializeSheets() {
  const supabase = getSupabaseClient();
  throwIfError(await supabase.from(SHEETS.USERS).select('id').limit(1));
}

// =============================================
// HELPER: Generate ID unik sederhana (SAMA seperti sebelumnya —
// PENTING dibiarkan sama supaya ID baru tetap kompatibel dengan ID
// lama hasil migrasi dari Google Sheets)
// =============================================
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// =============================================
// HELPER: Kode publik pendek buat link "kartu anak"
// =============================================
export function generateKodePublik() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let kode = '';
  for (let i = 0; i < 8; i++) kode += chars[Math.floor(Math.random() * chars.length)];
  return kode;
}
