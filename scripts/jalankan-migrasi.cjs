// Jalankan file SQL migrasi via pg (mendukung multi-statement dalam satu
// implicit transaction — gagal satu, semua rollback). Idempotent aman diulang.
// PAKAI: node scripts/jalankan-migrasi.cjs supabase/migrasi-kenaikan-kelas.sql
const fs = require('fs');
const path = require('path');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { Client } = require('pg');

(async () => {
  const file = process.argv[2];
  if (!file) { console.error('Pemakaian: node scripts/jalankan-migrasi.cjs <file.sql>'); process.exit(1); }
  const sql = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  try {
    // Simple query protocol: multi-statement, satu transaksi implisit
    await client.query(sql);
    console.log(`OK — ${file} dijalankan dalam satu transaksi.`);
  } catch (e) {
    console.error(`GAGAL — ${file}: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
