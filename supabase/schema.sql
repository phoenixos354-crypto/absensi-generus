-- =============================================================
-- Skema Supabase untuk Absensi Generus
-- Mengganti Google Sheets sebagai penyimpanan data.
-- Nama tabel & kolom SENGAJA dibuat sama persis dengan nama
-- sheet/header yang lama, supaya migrasi data 1:1 dan kode aplikasi
-- (src/lib/sheets.js) bisa tetap pakai nama yang sama.
--
-- Semua kolom non-id dibuat TEXT (bukan int/timestamp asli) supaya
-- perilakunya identik dengan Google Sheets yang dulu (semua nilai
-- otomatis jadi string) — jadi tidak perlu ubah logic di API routes.
--
-- Kolom `_seq` = urutan insert (mirip nomor baris di Google Sheets).
-- Dipakai internal saja untuk fitur "ambil data TERBARU" pada tabel
-- append-only (absensi, sesi, target_progress), TIDAK ditampilkan ke
-- aplikasi.
--
-- CARA PAKAI: buka Supabase Dashboard -> SQL Editor -> paste semua
-- isi file ini -> Run. Aman dijalankan sekali di project baru.
-- =============================================================

create table if not exists users (
  id text primary key,
  email text not null,
  name text,
  image text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_users_email on users (email);

create table if not exists kelompok (
  id text primary key,
  user_id text,
  nama_kelompok text,
  tingkatan text,
  desa text,
  daerah text,
  preset_id text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_kelompok_user_id on kelompok (user_id);

create table if not exists murid (
  id text primary key,
  kelompok_id text,
  nama_murid text,
  kode_publik text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_murid_kelompok_id on murid (kelompok_id);
create index if not exists idx_murid_kode_publik on murid (kode_publik);

create table if not exists jadwal (
  id text primary key,
  kelompok_id text,
  hari text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_jadwal_kelompok_id on jadwal (kelompok_id);

create table if not exists absensi (
  id text primary key,
  kelompok_id text,
  murid_id text,
  tanggal text,
  status text,
  dicatat_oleh text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_absensi_kelompok_id on absensi (kelompok_id);
create index if not exists idx_absensi_murid_id on absensi (murid_id);
create index if not exists idx_absensi_tanggal on absensi (tanggal);

create table if not exists admin_kelompok (
  id text primary key,
  kelompok_id text,
  email text,
  permission text,
  invited_by text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_admin_kelompok_kelompok_id on admin_kelompok (kelompok_id);
create index if not exists idx_admin_kelompok_email on admin_kelompok (email);

create table if not exists dalil_harian (
  id text primary key,
  tanggal text,
  tipe text,
  teks_arab text,
  teks_terjemah text,
  sumber text,
  mascot_index text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_dalil_harian_tanggal on dalil_harian (tanggal);

create table if not exists sesi (
  id text primary key,
  kelompok_id text,
  tanggal text,
  jurnal text,
  infaq text,
  dicatat_oleh text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_sesi_kelompok_id on sesi (kelompok_id);

create table if not exists target_preset (
  id text primary key,
  nama_preset text,
  dibuat_oleh_kelompok_id text,
  nama_kelompok_asal text,
  desa_asal text,
  daerah_asal text,
  dibuat_oleh_email text,
  created_at text,
  _seq bigint generated always as identity
);

create table if not exists target_item (
  id text primary key,
  preset_id text,
  tingkatan text,
  kategori text,
  urutan text,
  nama_item text,
  created_at text,
  kelas text,
  _seq bigint generated always as identity
);
create index if not exists idx_target_item_preset_id on target_item (preset_id);

create table if not exists target_progress (
  id text primary key,
  murid_id text,
  item_id text,
  nilai text,
  tanggal text,
  dicatat_oleh text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_target_progress_murid_id on target_progress (murid_id);
create index if not exists idx_target_progress_item_id on target_progress (item_id);

create table if not exists wilayah_jamaah (
  id text primary key,
  user_id text,
  nama_wilayah text,
  desa text,
  daerah text,
  kode_publik text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_wilayah_jamaah_user_id on wilayah_jamaah (user_id);
create index if not exists idx_wilayah_jamaah_kode_publik on wilayah_jamaah (kode_publik);

create table if not exists jamaah (
  id text primary key,
  wilayah_id text,
  nama text,
  umur text,
  jenis_kelamin text,
  status_pernikahan text,
  kategori_usia text,
  status_keluarga text,
  kepala_keluarga_id text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_jamaah_wilayah_id on jamaah (wilayah_id);
create index if not exists idx_jamaah_kepala_keluarga_id on jamaah (kepala_keluarga_id);

-- =============================================================
-- Tabel: pengeluaran_infaq
-- Mencatat pengeluaran infaq per kelompok (mis. beli buku, snack,
-- hadiah murid). Dipakai di halaman rekap per kelompok untuk
-- menghitung sisa infaq dan menampilkan rincian pengeluaran.
-- =============================================================
create table if not exists pengeluaran_infaq (
  id text primary key,
  kelompok_id text,
  tanggal text,
  keterangan text,
  jumlah text,
  dicatat_oleh text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_pengeluaran_infaq_kelompok_id on pengeluaran_infaq (kelompok_id);

-- =============================================================
-- Row Level Security: dimatikan (RLS off) karena semua akses ke
-- tabel ini SELALU lewat API routes Next.js pakai service role key
-- di server (sama seperti sebelumnya lewat Google service account),
-- bukan langsung dari browser. Kalau nanti mau akses dari client
-- langsung, baru perlu bikin RLS policy.
-- =============================================================
