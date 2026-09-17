export const KATEGORI = [
  { key: 'hafalan_doa',   label: 'Hafalan Doa' },
  { key: 'hafalan_surat', label: 'Hafalan Surat' },
  { key: 'akhlak',        label: 'Akhlak (29 Karakter)' },
  { key: 'bacaan',        label: 'Bacaan Tilawati/Qur\u2019an' },
  { key: 'makna_quran',   label: 'Makna Al-Qur\u2019an' },
  { key: 'makna_hadis',   label: 'Makna Hadis' },
];

// Keterangan kelas/jenjang sekolah, khusus dipakai di tingkatan Caberawit
// (karena Caberawit mencakup rentang usia Paud/TK s.d. SD Kelas 6).
// Ini murni informasi/tag per-item, tidak dipakai untuk filter otomatis.
export const KELAS_CABERAWIT = [
  { key: '',        label: 'Semua Kelas' },
  { key: 'paud_tk', label: 'Paud/TK' },
  { key: 'sd_1',    label: 'SD Kelas 1' },
  { key: 'sd_2',    label: 'SD Kelas 2' },
  { key: 'sd_3',    label: 'SD Kelas 3' },
  { key: 'sd_4',    label: 'SD Kelas 4' },
  { key: 'sd_5',    label: 'SD Kelas 5' },
  { key: 'sd_6',    label: 'SD Kelas 6' },
];

// Urutan kenaikan sub-kelas dalam satu kelompok Caberawit
// (dipakai fitur "Naik Kelas" — naik sub-kelas, kelompok tetap).
// Nilai '' (murid belum diisi kelasnya) sengaja tidak masuk daftar ini;
// murid tanpa sub_kelas tidak disarankan naik sub-kelas oleh sistem,
// keputusan tetap di tangan guru lewat checkbox manual.
export const URUTAN_SUB_KELAS = ['paud_tk', 'sd_1', 'sd_2', 'sd_3', 'sd_4', 'sd_5', 'sd_6'];

// Label sub-kelas TANPA opsi "Semua Kelas" — dipakai untuk badge tampilan,
// dropdown form murid, dan wizard Naik Kelas (di sana tidak ada artinya
// "semua"). Key '' = belum diisi.
export const KELAS_CABERAWIT_LABEL = {
  '': 'Belum diisi',
  paud_tk: 'Paud/TK',
  sd_1: 'SD Kelas 1',
  sd_2: 'SD Kelas 2',
  sd_3: 'SD Kelas 3',
  sd_4: 'SD Kelas 4',
  sd_5: 'SD Kelas 5',
  sd_6: 'SD Kelas 6',
};

// =============================================================
// KATEGORI BESAR — HANYA label/grouping TAMPILAN.
// Menggabungkan beberapa tingkatan jadi satu kelompok tampilan:
//   caberawit -> "Caberawit"
//   praremaja/remaja/usianikah -> "Muda/i"
// Nilai tingkatan yang tersimpan di database TIDAK berubah sama sekali.
// Dipakai sebagai opsi pengelompokan TAMBAHAN di dashboard/rekap,
// tanpa menghilangkan tampilan per-tingkatan yang lama.
// =============================================================
export const KATEGORI_BESAR = {
  caberawit: 'Caberawit',
  praremaja: 'Muda/i',
  remaja: 'Muda/i',
  usianikah: 'Muda/i',
};

// Urutan kategori besar untuk menampilkan tab (Caberawit dulu, lalu Muda/i)
export const URUTAN_KATEGORI_BESAR = ['caberawit', 'mudai'];

// Mapping key kategori besar -> label tampilan
export const KATEGORI_BESAR_LABEL = {
  caberawit: 'Caberawit',
  mudai: 'Muda/i',
};

// Tingkatan mana saja yang termasuk kategori besar "Muda/i"
export const TINGKATAN_MUDA_I = ['praremaja', 'remaja', 'usianikah'];

// Urutan jenjang dipakai buat cek "tunggakan dari level bawah".
// 'kelompok' sengaja tidak dimasukkan (di luar jenjang caberawit->usia nikah).
export const URUTAN_TINGKATAN = ['caberawit', 'praremaja', 'remaja', 'usianikah'];

export const DEFAULT_PRESET_ID = 'default';

export const NILAI_LIST = ['belum', 'A', 'B', 'C', 'D'];

export const NILAI_WARNA = {
  belum: 'bg-secondary text-muted-foreground',
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-sky-100 text-sky-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-rose-100 text-rose-700',
};

export const NILAI_LABEL = {
  belum: 'Belum Dinilai',
  A: 'Sangat Baik',
  B: 'Baik',
  C: 'Cukup',
  D: 'Perlu Bimbingan',
};

// Warna solid dipakai untuk bulatan indikator di popup pilih nilai
export const NILAI_DOT = {
  belum: 'bg-border',
  A: 'bg-emerald-500',
  B: 'bg-sky-500',
  C: 'bg-amber-500',
  D: 'bg-rose-500',
};
