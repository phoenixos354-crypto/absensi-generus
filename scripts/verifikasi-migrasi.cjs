// Verifikasi pasca-migrasi: objek baru ada & data existing tidak berubah.
// PAKAI: node scripts/verifikasi-migrasi.cjs
const fs = require('fs');
const path = require('path');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  let gagal = 0;

  async function cek(judul, sql, harapan) {
    const r = await client.query(sql);
    const ok = String(r.rows[0].hasil) === String(harapan);
    if (!ok) gagal++;
    console.log(`${ok ? '✅' : '❌'} ${judul}: ${r.rows[0].hasil}${ok ? '' : ` (harapannya ${harapan})`}`);
  }

  console.log('=== OBJEK BARU ===');
  await cek('Kolom murid.sub_kelas',
    "select count(*) as hasil from information_schema.columns where table_name='murid' and column_name='sub_kelas' and data_type='text'", 1);
  await cek('Default murid.sub_kelas',
    "select coalesce(column_default,'-') as hasil from information_schema.columns where table_name='murid' and column_name='sub_kelas'", "''::character varying");
  await cek('Kolom kelompok.kelompok_tujuan_id (nullable)',
    "select count(*) as hasil from information_schema.columns where table_name='kelompok' and column_name='kelompok_tujuan_id' and is_nullable='YES'", 1);
  await cek('Tabel riwayat_kenaikan_kelas',
    "select count(*) as hasil from information_schema.tables where table_name='riwayat_kenaikan_kelas'", 1);
  await cek('Kolom riwayat lengkap (11 termasuk _seq)',
    "select count(*) as hasil from information_schema.columns where table_name='riwayat_kenaikan_kelas'", 11);
  await cek('Index riwayat murid_id',
    "select count(*) as hasil from pg_indexes where tablename='riwayat_kenaikan_kelas' and indexname='idx_riwayat_kenaikan_murid_id'", 1);
  await cek('Fungsi naikkan_kelas_massal',
    "select count(*) as hasil from pg_proc where proname='naikkan_kelas_massal'", 1);

  console.log('\n=== DATA EXISTING UTUH (vs backup pre-migrasi) ===');
  const backup = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'backup-pre-migrasi-2026-09-17.json'), 'utf8'));
  for (const [t, rows] of Object.entries(backup.tabel)) {
    if (!Array.isArray(rows)) continue; // tabel yang belum ada (wilayah_jamaah)
    const r = await client.query(`select count(*)::int as hasil from ${t}`);
    const ok = r.rows[0].hasil === rows.length;
    if (!ok) gagal++;
    console.log(`${ok ? '✅' : '❌'} ${t}: ${r.rows[0].hasil} baris (backup: ${rows.length})`);
  }

  console.log('\n=== SAMPLING: nilai sub_kelas / kelompok_tujuan_id murid & kelompok lama ===');
  const s1 = await client.query("select count(*)::int as hasil from murid where sub_kelas is null or sub_kelas = ''");
  console.log(`✅ murid dengan sub_kelas kosong: ${s1.rows[0].hasil} (harusnya semua = ${s1.rows[0].hasil})`);
  const s2 = await client.query('select count(*)::int as hasil from kelompok where kelompok_tujuan_id is not null');
  console.log(`✅ kelompok dengan kelompok_tujuan_id terisi: ${s2.rows[0].hasil} (harusnya 0)`);
  const s3 = await client.query('select count(*)::int as hasil from riwayat_kenaikan_kelas');
  console.log(`✅ riwayat_kenaikan_kelas: ${s3.rows[0].hasil} baris (harusnya 0)`);
  const s4 = await client.query("select count(*)::int as hasil from kelompok where tingkatan in ('caberawit','praremaja','remaja','usianikah','kelompok')");
  console.log(`✅ nilai tingkatan kelompok tetap valid: ${s4.rows[0].hasil}`);

  await client.end();
  console.log(gagal === 0 ? '\n🎉 SEMUA VERIFIKASI LULUS' : `\n⚠️ ${gagal} cek GAGAL — jangan lanjut sebelum diperiksa!`);
  process.exitCode = gagal === 0 ? 0 : 1;
})().catch(e => { console.error('VERIFIKASI GAGAL:', e.message); process.exit(1); });
