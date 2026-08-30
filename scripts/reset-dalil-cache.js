// =============================================
// Script standalone untuk reset cache dalil harian di Google Sheets.
// SENGAJA dibuat sebagai script terpisah (bukan API route di aplikasi),
// supaya tidak ada endpoint tersembunyi yang bisa dipanggil orang lain
// kalau aplikasinya sudah live di Vercel. Cuma bisa dijalankan manual
// dari komputer kamu sendiri, pakai kredensial yang sama seperti di
// .env.local.
//
// CARA PAKAI (jalankan dari root project):
//
//   node --env-file=.env.local scripts/reset-dalil-cache.js
//       -> hapus cache dalil untuk HARI INI saja (paling umum dipakai,
//          buat coba lagi generate dalil hari ini tanpa nunggu besok)
//
//   node --env-file=.env.local scripts/reset-dalil-cache.js --date=2026-08-30
//       -> hapus cache untuk tanggal tertentu
//
//   node --env-file=.env.local scripts/reset-dalil-cache.js --all
//       -> hapus SEMUA baris di sheet dalil_harian (reset total riwayat,
//          termasuk daftar sumber yang dipakai untuk hindari pengulangan)
//
// Catatan: butuh Node 20.6+ untuk flag --env-file. Kalau versi Node kamu
// lebih lama, install "dotenv" lalu ganti baris require di bawah, atau
// export manual env var-nya sebelum menjalankan script ini.
// =============================================

const { google } = require('googleapis');
const readline = require('readline');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = 'dalil_harian';

function tanggalHariIni() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const hapusSemua = args.includes('--all');
  const dateArg = args.find(a => a.startsWith('--date='));
  const tanggal = dateArg ? dateArg.split('=')[1] : tanggalHariIni();
  return { hapusSemua, tanggal };
}

function tanya(pertanyaan) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(pertanyaan, jawaban => {
      rl.close();
      resolve(jawaban.trim().toLowerCase());
    });
  });
}

async function main() {
  if (!SPREADSHEET_ID) {
    console.error('❌ SPREADSHEET_ID tidak ditemukan. Pastikan dijalankan dengan --env-file=.env.local');
    process.exit(1);
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error('❌ Kredensial Google Service Account tidak ditemukan di environment.');
    process.exit(1);
  }

  const { hapusSemua, tanggal } = parseArgs();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Baca semua baris dulu
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) {
    console.log('ℹ️  Sheet dalil_harian masih kosong, tidak ada yang perlu dihapus.');
    return;
  }
  const headers = rows[0];
  const idxTanggal = headers.indexOf('tanggal');
  const idxSumber = headers.indexOf('sumber');

  const dataRows = rows.slice(1).map((row, i) => ({
    _row: i + 2, // nomor baris asli di sheet (1 = header)
    tanggal: row[idxTanggal] || '',
    sumber: row[idxSumber] || '',
  }));

  const targetRows = hapusSemua ? dataRows : dataRows.filter(r => r.tanggal === tanggal);

  if (targetRows.length === 0) {
    console.log(hapusSemua
      ? 'ℹ️  Tidak ada baris untuk dihapus.'
      : `ℹ️  Tidak ada cache dalil untuk tanggal ${tanggal}. Tidak ada yang dihapus.`);
    return;
  }

  console.log(hapusSemua
    ? `⚠️  Akan menghapus SEMUA (${targetRows.length}) baris cache dalil harian, termasuk seluruh riwayat sumber.`
    : `⚠️  Akan menghapus ${targetRows.length} baris cache untuk tanggal ${tanggal}:`);
  targetRows.forEach(r => console.log(`   - baris ${r._row}: ${r.tanggal} — ${r.sumber}`));

  const jawaban = await tanya('\nLanjutkan hapus? (ketik "ya" untuk konfirmasi): ');
  if (jawaban !== 'ya') {
    console.log('Dibatalkan, tidak ada yang dihapus.');
    return;
  }

  // Ambil sheetId numerik (dibutuhkan untuk deleteDimension)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetInfo = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);
  if (!sheetInfo) {
    console.error(`❌ Sheet "${SHEET_NAME}" tidak ditemukan di spreadsheet ini.`);
    process.exit(1);
  }
  const sheetId = sheetInfo.properties.sheetId;

  // Urutkan dari baris terbesar ke terkecil supaya penghapusan tidak
  // menggeser nomor baris lain yang belum diproses dalam batch yang sama.
  const rowNumbers = [...new Set(targetRows.map(r => r._row))].sort((a, b) => b - a);
  const requests = rowNumbers.map(rowNum => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log(`\n✅ Berhasil menghapus ${targetRows.length} baris dari sheet dalil_harian.`);
  if (!hapusSemua) {
    console.log(`   Buka lagi halaman dashboard untuk generate dalil baru hari ini (${tanggal}).`);
  }
}

main().catch(err => {
  console.error('❌ Gagal:', err.message);
  process.exit(1);
});
