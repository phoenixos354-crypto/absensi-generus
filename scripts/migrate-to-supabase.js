/**
 * Migrasi data dari Google Sheets ke Supabase.
 *
 * PENTING: script ini menyalin data APA ADANYA, termasuk semua ID
 * (kelompok, murid, dst) dipertahankan PERSIS SAMA. Jadi kepemilikan
 * kelompok, hubungan murid-kelompok, riwayat absensi, dan semua
 * relasi lain TETAP UTUH setelah pindah — user yang sudah ada tidak
 * akan kehilangan data atau akses.
 *
 * Aman dijalankan berkali-kali (idempotent): pakai upsert, jadi kalau
 * dijalankan ulang, baris yang sudah ada di Supabase akan ditimpa
 * dengan data terbaru dari Google Sheets, bukan bikin duplikat.
 *
 * CARA PAKAI:
 *   1. Pastikan supabase/schema.sql SUDAH dijalankan di Supabase Dashboard
 *      (SQL Editor) untuk membuat semua tabel.
 *   2. Isi .env.local dengan SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 *      TANPA menghapus dulu env var Google Sheets yang lama
 *      (SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY)
 *      — keduanya masih dibutuhkan sekaligus, khusus untuk proses migrasi ini.
 *   3. Jalankan:
 *        node --env-file=.env.local scripts/migrate-to-supabase.js
 *      Tambahkan --dry-run kalau cuma mau lihat ringkasan tanpa nulis
 *      apa-apa ke Supabase dulu:
 *        node --env-file=.env.local scripts/migrate-to-supabase.js --dry-run
 *
 * KAPAN JALANIN INI: sebaiknya pas traffic lagi sepi, dan LANGSUNG
 * deploy kode versi baru (yang sudah pakai Supabase) begitu script ini
 * selesai — supaya tidak ada data yang sempat ditulis ke Google Sheets
 * di sela-sela waktu itu dan ketinggalan ter-migrasi.
 */

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SPREADSHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  console.error('❌ Env var Google Sheets belum lengkap (SPREADSHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Env var Supabase belum lengkap (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

// Daftar tabel + urutan kolom — HARUS SAMA PERSIS dengan HEADERS di
// src/lib/sheets.js dan kolom di supabase/schema.sql.
const TABLES = [
  { sheet: 'users',           headers: ['id', 'email', 'name', 'image', 'created_at'] },
  { sheet: 'kelompok',        headers: ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'] },
  { sheet: 'murid',           headers: ['id', 'kelompok_id', 'nama_murid', 'kode_publik', 'created_at'] },
  { sheet: 'jadwal',          headers: ['id', 'kelompok_id', 'hari', 'created_at'] },
  { sheet: 'absensi',         headers: ['id', 'kelompok_id', 'murid_id', 'tanggal', 'status', 'dicatat_oleh', 'created_at'] },
  { sheet: 'admin_kelompok',  headers: ['id', 'kelompok_id', 'email', 'permission', 'invited_by', 'created_at'] },
  { sheet: 'dalil_harian',    headers: ['id', 'tanggal', 'tipe', 'teks_arab', 'teks_terjemah', 'sumber', 'mascot_index', 'created_at'] },
  { sheet: 'sesi',            headers: ['id', 'kelompok_id', 'tanggal', 'jurnal', 'infaq', 'dicatat_oleh', 'created_at'] },
  { sheet: 'target_preset',   headers: ['id', 'nama_preset', 'dibuat_oleh_kelompok_id', 'nama_kelompok_asal', 'desa_asal', 'daerah_asal', 'dibuat_oleh_email', 'created_at'] },
  { sheet: 'target_item',     headers: ['id', 'preset_id', 'tingkatan', 'kategori', 'urutan', 'nama_item', 'created_at', 'kelas'] },
  { sheet: 'target_progress', headers: ['id', 'murid_id', 'item_id', 'nilai', 'tanggal', 'dicatat_oleh', 'created_at'] },
];

const BATCH_SIZE = 500;

function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: GOOGLE_PRIVATE_KEY },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function readGoogleSheet(sheets, sheetName, headers) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const actualHeaders = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    actualHeaders.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    // Susun ulang sesuai urutan HEADERS yang kita pakai di Supabase,
    // isi '' kalau kolomnya belum ada di sheet lama.
    return Object.fromEntries(headers.map(h => [h, obj[h] ?? '']));
  }).filter(r => r.id); // skip baris kosong tanpa id
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — tidak akan menulis apa pun ke Supabase.\n' : '🚀 Memulai migrasi Google Sheets → Supabase.\n');

  const sheets = getGoogleSheetsClient();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const summary = [];

  for (const { sheet, headers } of TABLES) {
    process.stdout.write(`→ Membaca "${sheet}" dari Google Sheets... `);
    let rows;
    try {
      rows = await readGoogleSheet(sheets, sheet, headers);
    } catch (e) {
      console.log(`\n  ⚠️  Sheet "${sheet}" tidak ditemukan / gagal dibaca (${e.message}). Dilewati.`);
      summary.push({ sheet, jumlah: 0, status: 'dilewati' });
      continue;
    }
    console.log(`${rows.length} baris.`);

    // Dedup by id — jaga-jaga kalau di sheet lama ada id yang kembar
    // (Google Sheets tidak pernah memaksa id harus unik). Simpan baris
    // yang PALING TERAKHIR muncul untuk id yang sama, karena itu yang
    // paling merepresentasikan state terbaru. Postgres tidak bisa
    // upsert baris dengan id sama dua kali dalam satu perintah, jadi
    // ini WAJIB dilakukan sebelum ditulis ke Supabase.
    const seen = new Map();
    let dupCount = 0;
    for (const row of rows) {
      if (seen.has(row.id)) dupCount++;
      seen.set(row.id, row); // yang belakangan menimpa yang duluan
    }
    if (dupCount > 0) {
      const contohId = [...seen.keys()].slice(0, 5);
      console.log(`  ⚠️  Ditemukan ${dupCount} baris dengan id kembar di "${sheet}" — dipakai versi terakhirnya saja. Contoh id: ${contohId.join(', ')}${seen.size > 5 ? ', ...' : ''}`);
    }
    rows = [...seen.values()];

    if (rows.length === 0) {
      summary.push({ sheet, jumlah: 0, status: 'kosong' });
      continue;
    }

    if (DRY_RUN) {
      summary.push({ sheet, jumlah: rows.length, status: dupCount > 0 ? `akan ditulis (dry-run, ${dupCount} duplikat digabung)` : 'akan ditulis (dry-run)' });
      continue;
    }

    process.stdout.write(`  Menulis ke Supabase (batch ${BATCH_SIZE})... `);
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from(sheet).upsert(batch, { onConflict: 'id' });
      if (error) {
        console.log('\n');
        throw new Error(`Gagal menulis batch ke tabel "${sheet}": ${error.message}`);
      }
      process.stdout.write('.');
    }
    console.log(' selesai.');
    summary.push({ sheet, jumlah: rows.length, status: dupCount > 0 ? `berhasil (${dupCount} duplikat digabung)` : 'berhasil' });
  }

  console.log('\n=== Ringkasan ===');
  for (const s of summary) {
    console.log(`  ${s.sheet.padEnd(18)} ${String(s.jumlah).padStart(5)} baris  — ${s.status}`);
  }
  console.log(DRY_RUN
    ? '\nDry run selesai. Jalankan lagi tanpa --dry-run untuk benar-benar menulis ke Supabase.'
    : '\n✅ Migrasi selesai. Cek datanya di Supabase Dashboard sebelum deploy kode versi baru.');
}

main().catch(err => {
  console.error('\n❌ Migrasi gagal:', err.message);
  process.exit(1);
});
