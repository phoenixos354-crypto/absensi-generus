export const KATEGORI = [
  { key: 'hafalan_doa',   label: 'Hafalan Doa' },
  { key: 'hafalan_surat', label: 'Hafalan Surat' },
  { key: 'akhlak',        label: 'Akhlak (29 Karakter)' },
  { key: 'bacaan',        label: 'Bacaan Tilawati/Qur\u2019an' },
  { key: 'makna_quran',   label: 'Makna Al-Qur\u2019an' },
  { key: 'makna_hadis',   label: 'Makna Hadis' },
];

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
