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
    lansia: 0,
    janda: 0,
    duda: 0,
    muda_mudi: 0,
    usia_nikah: 0,
    caberawit: 0,
  };

  for (const j of list) {
    if (j.status_keluarga === 'kepala_keluarga') stats.jumlah_kk += 1;
    if (j.jenis_kelamin === 'L') stats.laki_laki += 1;
    if (j.jenis_kelamin === 'P') stats.perempuan += 1;
    if (j.status_pernikahan === 'janda') stats.janda += 1;
    if (j.status_pernikahan === 'duda') stats.duda += 1;
    if (j.kategori_usia === 'lansia') stats.lansia += 1;
    if (j.kategori_usia === 'muda_mudi') stats.muda_mudi += 1;
    if (j.kategori_usia === 'usia_nikah') stats.usia_nikah += 1;
    if (j.kategori_usia === 'caberawit') stats.caberawit += 1;
  }

  return stats;
}
