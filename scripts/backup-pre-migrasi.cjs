// Backup data semua tabel aplikasi ke JSON + metadata skema.
// Dipakai sebelum migrasi sub-kelas & kenaikan kelas (2026-09-17).
// PAKAI: node scripts/backup-pre-migrasi.cjs
const fs = require('fs');
const path = require('path');

// Baca .env.local sederhana (KEY=value)
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { Client } = require('pg');

const TABEL = [
  'users', 'kelompok', 'murid', 'jadwal', 'absensi', 'admin_kelompok',
  'dalil_harian', 'sesi', 'target_preset', 'target_item', 'target_progress',
  'wilayah_jamaah', 'jamaah', 'pengeluaran_infaq', 'kas',
];

(async () => {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();

  const backup = { dibuat: new Date().toISOString(), tabel: {} };
  for (const t of TABEL) {
    try {
      const res = await client.query(`select * from ${t}`);
      backup.tabel[t] = res.rows;
      console.log(`${t}: ${res.rows.length} baris`);
    } catch (e) {
      backup.tabel[t] = { error: e.message };
      console.log(`${t}: ERROR — ${e.message}`);
    }
  }

  // Simpan juga daftar tabel + kolom saat ini (bukti kondisi skema pre-migrasi)
  const kolom = await client.query(
    "select table_name, column_name, data_type, column_default from information_schema.columns where table_schema='public' order by table_name, ordinal_position"
  );
  backup.skema_kolom = kolom.rows;

  const outFile = path.join(__dirname, '..', 'supabase', `backup-pre-migrasi-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2));
  const ukuran = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
  console.log(`\nBackup tersimpan: ${outFile} (${ukuran} MB)`);
  await client.end();
})().catch(e => { console.error('BACKUP GAGAL:', e.message); process.exit(1); });
