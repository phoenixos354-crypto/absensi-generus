import { KATEGORI_USIA_JAMAAH } from './jamaah-constants';

// Hitung rekap data jamaah (dipakai di API detail kelompok maupun API publik)
// dari daftar baris `jamaah`. Sengaja diletakkan di satu tempat supaya
// angka yang tampil di halaman kelola (login) dan kartu publik (tanpa
// login) selalu konsisten.
export function hitungStatsJamaah(daftarJamaah) {
  const list = daftarJamaah || [];

  const stats = {
    total: list.length,
    jumlah_kk: 0,
    laki_laki: 0,
    perempuan: 0,
    janda: 0,
    duda: 0,
  };
  // Siapkan satu counter per kategori usia (paud, caberawit, pra_remaja, dst)
  // otomatis dari daftar kategori, supaya kategori baru ke depannya tidak
  // perlu tambah baris manual di sini lagi.
  for (const kat of KATEGORI_USIA_JAMAAH) stats[kat.key] = 0;

  for (const j of list) {
    if (j.status_keluarga === 'kepala_keluarga') stats.jumlah_kk += 1;
    if (j.jenis_kelamin === 'L') stats.laki_laki += 1;
    if (j.jenis_kelamin === 'P') stats.perempuan += 1;
    if (j.status_pernikahan === 'janda') stats.janda += 1;
    if (j.status_pernikahan === 'duda') stats.duda += 1;
    if (j.kategori_usia && Object.prototype.hasOwnProperty.call(stats, j.kategori_usia)) {
      stats[j.kategori_usia] += 1;
    }
  }

  return stats;
}
