-- =============================================================
-- MIGRASI: Kenaikan Kelas (Naik Sub-Kelas & Naik Tingkat Besar)
-- =============================================================
-- Mendukung fitur "Naik Kelas" yang dijalankan guru SECARA EKSPLISIT
-- (tidak pernah otomatis di background):
--   1. Naik sub-kelas (khusus Caberawit): Paud/TK -> SD 1 -> ... -> SD 6.
--      Cukup mengubah murid.sub_kelas, kelompok_id TIDAK berubah, jadi
--      histori absensi/kas/progress tetap utuh.
--   2. Naik tingkat besar (pindah kelompok): dari Caberawit ke Pra Remaja,
--      dst — mengikuti urutan URUTAN_TINGKATAN di src/lib/target-constants.js.
--      Mengubah murid.kelompok_id.
--
-- PENTING — MIGRASI INI 100% ADDITIVE & IDEMPOTENT:
--   - Tidak ada DROP, tidak ada RENAME, tidak ada UPDATE massal.
--   - Aman dijalankan berulang kali (IF NOT EXISTS di semua objek).
--   - Kolom `kelompok_tujuan_id` nullable tanpa default — kelompok lama
--     otomatis terbaca NULL (belum pernah memilih tujuan kenaikan).
--   - Tabel `kelompok` dan kolom `tingkatan` TIDAK disentuh sama sekali.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> paste semua isi file
-- ini -> Run. Boleh dijalankan berkali-kali tanpa efek samping.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Kolom di tabel kelompok: pilihan kelompok tujuan kenaikan
-- -------------------------------------------------------------
-- Guru memilih SEKALI di wizard "Naik Kelas" (langkah 1) ke kelompok mana
-- murid kelompok ini akan dinaikkan (mis. kelompok Pra Remaja se-SDA).
-- Nullable: NULL = belum pernah memilih. Tidak mengubah perilaku apa pun
-- yang sudah ada — hanya dibaca oleh fitur Naik Kelas.
alter table kelompok add column if not exists kelompok_tujuan_id text;

-- -------------------------------------------------------------
-- 2) Tabel riwayat kenaikan kelas (append-only, pola sama dengan tabel
--    lain di schema.sql: id text primary key + _seq identity)
-- -------------------------------------------------------------
-- Satu baris per SATU murid yang dinaikkan, dibuat oleh API
-- /api/kenaikan-kelas di dalam satu operasi massal.
--   jenis           : 'sub_kelas' (naik kelas dalam kelompok yang sama)
--                     | 'tingkat' (pindah kelompok / naik tingkat besar)
--   dari_kelompok_id: kelompok asal murid
--   ke_kelompok_id  : kelompok tujuan (= dari_kelompok_id kalau sub_kelas)
--   dari_sub_kelas  : sub_kelas sebelum naik ('' kalau tidak diisi)
--   ke_sub_kelas    : sub_kelas sesudah naik ('' kalau tidak relevan)
--   tanggal         : tanggal aksi (YYYY-MM-DD, waktu lokal server)
--   dicatat_oleh    : email guru yang menekan tombol konfirmasi
create table if not exists riwayat_kenaikan_kelas (
  id text primary key,
  murid_id text,
  jenis text,
  dari_kelompok_id text,
  ke_kelompok_id text,
  dari_sub_kelas text,
  ke_sub_kelas text,
  tanggal text,
  dicatat_oleh text,
  created_at text,
  _seq bigint generated always as identity
);

-- Index untuk lookup riwayat per murid (dipakai wizard/riwayat kenaikan)
create index if not exists idx_riwayat_kenaikan_murid_id on riwayat_kenaikan_kelas (murid_id);

-- Index pelengkap: riwayat per kelompok asal & tujuan (opsional tapi murah)
create index if not exists idx_riwayat_kenaikan_dari_kelompok on riwayat_kenaikan_kelas (dari_kelompok_id);
create index if not exists idx_riwayat_kenaikan_ke_kelompok on riwayat_kenaikan_kelas (ke_kelompok_id);

-- -------------------------------------------------------------
-- 3) Fungsi transaksional kenaikan massal (dipanggil API lewat RPC)
-- -------------------------------------------------------------
-- Mengubah SEMUA murid yang dipilih + mencatat riwayatnya dalam SATU
-- transaksi Postgres: kalau ada satu saja yang gagal, SEMUA dibatalkan
-- (tidak akan ada murid yang "naik setengah jalan").
--
-- catatan tambahan, hanya kalau mau lebih aman:
--   create or replace = idempotent, aman dijalankan berulang kali.
--   Tidak mengubah tabel apa pun, hanya MENAMBAH fungsi baru.
create or replace function naikkan_kelas_massal(
  p_murid_ids text[],
  p_riwayat_ids text[],
  p_jenis text,
  p_dari_kelompok_id text,
  p_ke_kelompok_id text,
  p_ke_sub_kelas text,
  p_tanggal text,
  p_dicatat_oleh text,
  p_created_at text
)
returns integer
language plpgsql
as $$
declare
  m murid%rowtype;
  i int;
  v_count int := 0;
begin
  -- Validasi dasar
  if p_murid_ids is null or p_riwayat_ids is null
     or array_length(p_murid_ids, 1) is null
     or array_length(p_murid_ids, 1) <> array_length(p_riwayat_ids, 1) then
    raise exception 'jumlah murid_ids dan riwayat_ids harus sama & tidak boleh kosong';
  end if;
  if p_jenis not in ('sub_kelas', 'tingkat') then
    raise exception 'jenis tidak valid';
  end if;

  for i in 1 .. array_length(p_murid_ids, 1) loop
    -- Kunci baris murid (FOR UPDATE) supaya aman dari akses bersamaan
    select * into m from murid where id = p_murid_ids[i] for update;
    if not found then
      raise exception 'murid % tidak ditemukan', p_murid_ids[i];
    end if;
    if m.kelompok_id is distinct from p_dari_kelompok_id then
      raise exception 'murid % bukan bagian dari kelompok asal', p_murid_ids[i];
    end if;

    -- Naikkan murid:
    --   sub_kelas : kelompok_id tetap, sub_kelas berubah
    --   tingkat   : kelompok_id berubah, sub_kelas dikosongkan
    update murid set
      kelompok_id = case when p_jenis = 'tingkat' then p_ke_kelompok_id else m.kelompok_id end,
      sub_kelas   = case when p_jenis = 'sub_kelas' then coalesce(p_ke_sub_kelas, '') else '' end
    where id = m.id;

    -- Catat riwayat
    insert into riwayat_kenaikan_kelas
      (id, murid_id, jenis, dari_kelompok_id, ke_kelompok_id, dari_sub_kelas, ke_sub_kelas, tanggal, dicatat_oleh, created_at)
    values
      (p_riwayat_ids[i], m.id, p_jenis, p_dari_kelompok_id,
       case when p_jenis = 'tingkat' then p_ke_kelompok_id else p_dari_kelompok_id end,
       coalesce(m.sub_kelas, ''),
       case when p_jenis = 'sub_kelas' then coalesce(p_ke_sub_kelas, '') else '' end,
       p_tanggal, p_dicatat_oleh, p_created_at);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
