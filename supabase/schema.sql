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
  sumber_dana text,
  dicatat_oleh text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_pengeluaran_infaq_kelompok_id on pengeluaran_infaq (kelompok_id);

-- Tabel Kas: iuran wajib per anak per pertemuan
create table if not exists kas (
  id text primary key,
  kelompok_id text,
  murid_id text,
  tanggal text,
  jumlah text,
  dicatat_oleh text,
  created_at text,
  _seq bigint generated always as identity
);
create index if not exists idx_kas_kelompok_id on kas (kelompok_id);
create index if not exists idx_kas_murid_id on kas (murid_id);
create index if not exists idx_kas_tanggal on kas (tanggal);

-- Menambahkan kolom sumber_dana yang hilang ke tabel pengeluaran_infaq
-- Dibutuhkan untuk rekap endpoint setelah perubahan terbaru
alter table pengeluaran_infaq add column if not exists sumber_dana text default 'infaq';

-- =============================================================
-- Tabel: murid — kolom tambahan (ADDITIVE, aman untuk DB yang sudah live)
-- =============================================================

-- Sub-kelas / kelas sekolah murid (khusus tingkatan caberawit).
-- Nilai: '' (kosong = tidak diisi), 'paud_tk', 'sd_1' .. 'sd_6'
-- (lihat KELAS_CABERAWIT di src/lib/target-constants.js).
-- Murid lama otomatis terbaca kosong — tidak ada UPDATE massal.
alter table murid add column if not exists sub_kelas text default '';

-- =============================================================
-- Tabel: kelompok — kolom tambahan (ADDITIVE, aman untuk DB yang sudah live)
-- =============================================================

-- Pilihan kelompok tujuan kenaikan kelas, diisi guru SEKALI lewat wizard
-- "Naik Kelas" (langkah 1). Nullable: NULL = belum pernah memilih.
-- Hanya dibaca fitur Naik Kelas; tidak mengubah perilaku yang sudah ada.
alter table kelompok add column if not exists kelompok_tujuan_id text;

-- =============================================================
-- Tabel: riwayat_kenaikan_kelas (append-only)
-- Satu baris per SATU murid yang dinaikkan, dibuat API /api/kenaikan-kelas:
--   jenis = 'sub_kelas' (naik kelas dalam kelompok yang sama, cukup ubah
--           murid.sub_kelas) | 'tingkat' (pindah kelompok, ubah murid.kelompok_id)
-- =============================================================
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
create index if not exists idx_riwayat_kenaikan_murid_id on riwayat_kenaikan_kelas (murid_id);
create index if not exists idx_riwayat_kenaikan_dari_kelompok on riwayat_kenaikan_kelas (dari_kelompok_id);
create index if not exists idx_riwayat_kenaikan_ke_kelompok on riwayat_kenaikan_kelas (ke_kelompok_id);

-- =============================================================
-- Fungsi transaksional kenaikan kelas massal (dipanggil API lewat RPC).
-- Semua update murid + pencatatan riwayat terjadi dalam SATU transaksi:
-- kalau satu saja gagal, SEMUA dibatalkan. create or replace = idempotent.
-- =============================================================
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
  if p_murid_ids is null or p_riwayat_ids is null
     or array_length(p_murid_ids, 1) is null
     or array_length(p_murid_ids, 1) <> array_length(p_riwayat_ids, 1) then
    raise exception 'jumlah murid_ids dan riwayat_ids harus sama & tidak boleh kosong';
  end if;
  if p_jenis not in ('sub_kelas', 'tingkat') then
    raise exception 'jenis tidak valid';
  end if;

  for i in 1 .. array_length(p_murid_ids, 1) loop
    select * into m from murid where id = p_murid_ids[i] for update;
    if not found then
      raise exception 'murid % tidak ditemukan', p_murid_ids[i];
    end if;
    if m.kelompok_id is distinct from p_dari_kelompok_id then
      raise exception 'murid % bukan bagian dari kelompok asal', p_murid_ids[i];
    end if;

    update murid set
      kelompok_id = case when p_jenis = 'tingkat' then p_ke_kelompok_id else m.kelompok_id end,
      sub_kelas   = case when p_jenis = 'sub_kelas' then coalesce(p_ke_sub_kelas, '') else '' end
    where id = m.id;

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

-- Jam kedatangan otomatis saat absen/scan QR (format HH:MM, mis. 07:35)
alter table absensi add column if not exists jam_datang text default '';

-- =============================================================
-- Row Level Security: dimatikan (RLS off) karena semua akses ke
-- tabel ini SELALU lewat API routes Next.js pakai service role key
-- di server (sama seperti sebelumnya lewat Google service account),
-- bukan langsung dari browser. Kalau nanti mau akses dari client
-- langsung, baru perlu bikin RLS policy.
-- =============================================================
