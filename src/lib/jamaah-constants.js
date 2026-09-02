import {
  Baby, Sprout, BookOpen, GraduationCap, Users2, Heart, Briefcase, Flower2,
  Home, Users, Mars, Venus, HeartCrack,
} from 'lucide-react';

// Kategori usia jamaah — dipilih MANUAL saat input (bukan otomatis dari
// umur), karena batas usia tiap kategori bisa beda-beda kebijakannya per
// kelompok/daerah.
export const KATEGORI_USIA_JAMAAH = [
  { key: 'paud',        label: 'Paud',        Icon: Baby },
  { key: 'caberawit',   label: 'Caberawit',   Icon: Sprout },
  { key: 'pra_remaja',  label: 'Pra Remaja',  Icon: BookOpen },
  { key: 'remaja',      label: 'Remaja',      Icon: GraduationCap },
  { key: 'muda_mudi',   label: 'Muda-Mudi',   Icon: Users2 },
  { key: 'usia_nikah',  label: 'Usia Nikah',  Icon: Heart },
  { key: 'dewasa',      label: 'Dewasa',      Icon: Briefcase },
  { key: 'lansia',      label: 'Lansia',      Icon: Flower2 },
];

export function getKategoriUsiaJamaah(key) {
  return KATEGORI_USIA_JAMAAH.find(k => k.key === key) || null;
}

// Kartu-kartu rekap statistik jamaah, dipakai di halaman kelola jamaah
// (login) dan kartu publik (tanpa login). Digabung dari data dasar
// (KK/gender/status pernikahan) + kategori usia, supaya kalau kategori usia
// nambah/berubah, kartu rekap di kedua halaman otomatis ikut berubah tanpa
// perlu edit daftar duplikat di masing-masing halaman.
export const STAT_CARDS_JAMAAH = [
  { key: 'jumlah_kk', label: 'Kepala Keluarga', Icon: Home },
  { key: 'total',     label: 'Total Jamaah',    Icon: Users },
  { key: 'laki_laki', label: 'Laki-laki',       Icon: Mars },
  { key: 'perempuan', label: 'Perempuan',       Icon: Venus },
  ...KATEGORI_USIA_JAMAAH.map(({ key, label, Icon }) => ({ key, label, Icon })),
  { key: 'janda', label: 'Janda', Icon: HeartCrack },
  { key: 'duda',  label: 'Duda',  Icon: HeartCrack },
];

export const JENIS_KELAMIN_JAMAAH = [
  { key: 'L', label: 'Laki-laki' },
  { key: 'P', label: 'Perempuan' },
];

export const STATUS_PERNIKAHAN_JAMAAH = [
  { key: 'belum_menikah', label: 'Belum Menikah' },
  { key: 'menikah',       label: 'Menikah' },
  { key: 'janda',         label: 'Janda' },
  { key: 'duda',          label: 'Duda' },
];

// Status posisi dalam keluarga. 'lainnya' = pilihan bebas untuk jamaah yang
// tidak mau/tidak relevan dikaitkan ke KK manapun (mis. tinggal sendiri).
export const STATUS_KELUARGA_JAMAAH = [
  { key: 'kepala_keluarga', label: 'Kepala Keluarga' },
  { key: 'anggota_keluarga', label: 'Anggota Keluarga' },
  { key: 'lainnya', label: 'Lainnya (Tidak Terikat KK)' },
];

export function getStatusKeluargaLabel(key) {
  return STATUS_KELUARGA_JAMAAH.find(s => s.key === key)?.label || '-';
}

export function getStatusPernikahanLabel(key) {
  return STATUS_PERNIKAHAN_JAMAAH.find(s => s.key === key)?.label || '-';
}
