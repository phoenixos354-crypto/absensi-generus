import { Sprout, Flower2, Users2, Heart } from 'lucide-react';

// Kategori usia jamaah — dipilih MANUAL saat input (bukan otomatis dari
// umur), karena batas usia tiap kategori bisa beda-beda kebijakannya per
// wilayah/daerah.
export const KATEGORI_USIA_JAMAAH = [
  { key: 'caberawit',  label: 'Caberawit',  Icon: Sprout },
  { key: 'muda_mudi',  label: 'Muda-Mudi',  Icon: Users2 },
  { key: 'usia_nikah', label: 'Usia Nikah', Icon: Heart },
  { key: 'lansia',     label: 'Lansia',     Icon: Flower2 },
];

export function getKategoriUsiaJamaah(key) {
  return KATEGORI_USIA_JAMAAH.find(k => k.key === key) || null;
}

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
