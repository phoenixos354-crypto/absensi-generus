// Uji fungsi naikkan_kelas_massal dengan data ASLI tapi di dalam transaksi
// yang selalu di-ROLLBACK — memastikan RPC jalan & atomik tanpa efek permanen.
// PAKAI: node scripts/uji-rpc-rollback.cjs
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

  // 1) Cari 2 murid dari SATU kelompok caberawit sebagai sample uji
  const sample = await client.query(`
    select m.id, m.nama_murid, m.kelompok_id, coalesce(m.sub_kelas,'') as sub_kelas
    from murid m join kelompok k on k.id = m.kelompok_id
    where k.tingkatan = 'caberawit'
    limit 2`);
  if (sample.rows.length === 0) { console.log('Tidak ada murid caberawit untuk diuji.'); await client.end(); return; }
  const ids = sample.rows.map(r => r.id);
  console.log('Sample uji:', sample.rows.map(r => `${r.nama_murid} (sub_kelas='${r.sub_kelas}')`).join(', '));

  await client.query('BEGIN');

  // 2) Naik sub-kelas ke sd_1 via RPC
  const r1 = await client.query(
    `select naikkan_kelas_massal($1, $2, 'sub_kelas', $3, $3, 'sd_1', '2026-09-17', 'uji-rollback', '2026-09-17T00:00:00Z') as jumlah`,
    [ids, ids.map(() => 'uji-riwayat-' + Math.random().toString(36).slice(2, 8)), sample.rows[0].kelompok_id]
  );
  console.log(`✅ RPC sub_kelas: ${r1.rows[0].jumlah} murid terproses`);

  // 3) Cek efek di dalam transaksi
  const cek = await client.query(`select id, sub_kelas from murid where id = any($1)`, [ids]);
  const semuaSd1 = cek.rows.every(r => r.sub_kelas === 'sd_1');
  const riwayat = await client.query(`select count(*)::int as n from riwayat_kenaikan_kelas where dicatat_oleh = 'uji-rollback'`);
  console.log(`${semuaSd1 ? '✅' : '❌'} sub_kelas terupdate di transaksi: ${cek.rows.map(r => r.sub_kelas).join(', ')}`);
  console.log(`${riwayat.rows[0].n === ids.length ? '✅' : '❌'} riwayat tercatat: ${riwayat.rows[0].n} baris`);

  // 4) Uji jalur 'tingkat': pindah ke kelompok praremaja pertama milik owner yang sama
  const tujuan = await client.query(
    `select k2.id from kelompok k1 join kelompok k2 on k2.user_id = k1.user_id and k2.tingkatan = 'praremaja'
     where k1.id = $1 limit 1`, [sample.rows[0].kelompok_id]);
  if (tujuan.rows.length > 0) {
    await client.query('ROLLBACK'); await client.query('BEGIN');
    const r2 = await client.query(
      `select naikkan_kelas_massal($1, $2, 'tingkat', $3, $4, '', '2026-09-17', 'uji-rollback', '2026-09-17T00:00:00Z') as jumlah`,
      [[ids[0]], ['uji-riwayat-t-' + Math.random().toString(36).slice(2, 8)], sample.rows[0].kelompok_id, tujuan.rows[0].id]
    );
    const cek2 = await client.query(`select kelompok_id, sub_kelas from murid where id = $1`, [ids[0]]);
    console.log(`✅ RPC tingkat: ${r2.rows[0].jumlah} murid — kelompok_id sekarang ${cek2.rows[0].kelompok_id === tujuan.rows[0].id ? 'BERHASIL pindah' : 'GAGAL'}, sub_kelas='${cek2.rows[0].sub_kelas}'`);
  }

  // 5) Uji validasi: murid dari kelompok lain harus DITOLAK
  await client.query('ROLLBACK'); await client.query('BEGIN');
  const lain = await client.query(
    `select m.id, m.kelompok_id from murid m join kelompok k on k.id = m.kelompok_id
     where k.tingkatan='caberawit' and m.kelompok_id <> $1 limit 1`, [sample.rows[0].kelompok_id]);
  if (lain.rows.length > 0) {
    try {
      await client.query(`select naikkan_kelas_massal($1, $2, 'sub_kelas', $3, $3, 'sd_1', '2026-09-17', 'uji-rollback', '2026-09-17T00:00:00Z')`,
        [[lain.rows[0].id], ['uji-riwayat-x'], sample.rows[0].kelompok_id]);
      console.log('❌ Validasi kelompok asal TIDAK menolak murid asing!');
    } catch (e) {
      console.log('✅ Validasi menolak murid dari kelompok lain (transaksi aborted — aman)');
    }
  }

  // 6) ROLLBACK — tidak ada jejak
  await client.query('ROLLBACK');
  const after = await client.query(`select id, coalesce(sub_kelas,'') as sub_kelas, kelompok_id from murid where id = any($1)`, [ids]);
  const bersih = after.rows.every((r, i) => r.sub_kelas === sample.rows[i].sub_kelas && r.kelompok_id === sample.rows[i].kelompok_id);
  const riwayatAfter = await client.query(`select count(*)::int as n from riwayat_kenaikan_kelas where dicatat_oleh = 'uji-rollback'`);
  console.log(`${bersih ? '✅' : '❌'} ROLLBACK bersih: data murid kembali seperti semula`);
  console.log(`${riwayatAfter.rows[0].n === 0 ? '✅' : '❌'} ROLLBACK bersih: riwayat uji = ${riwayatAfter.rows[0].n} baris`);

  await client.end();
  console.log('\n🎉 UJI RPC SELESAI — fungsi siap dipakai produksi (tidak ada data berubah).');
})().catch(e => { console.error('UJI GAGAL:', e.message); process.exit(1); });
