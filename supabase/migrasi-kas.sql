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
alter table pengeluaran_infaq add column if not exists sumber_dana text default 'infaq';
