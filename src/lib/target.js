import { readSheet, appendRows, SHEETS, generateId } from '@/lib/sheets';
import { KATEGORI, URUTAN_TINGKATAN, DEFAULT_PRESET_ID } from '@/lib/target-constants';

export { KATEGORI, URUTAN_TINGKATAN, DEFAULT_PRESET_ID };

// =============================================
// DUMMY DEFAULT — ganti/lengkapi lewat menu "Kelola Target" nanti.
// Ini cuma contoh awal biar sistemnya langsung bisa dipakai/dites.
// =============================================
const DUMMY = {
  caberawit: {
    hafalan_doa:   ['Doa Sebelum Belajar', 'Doa Kedua Orang Tua', 'Doa Masuk Kamar Mandi'],
    hafalan_surat: ['An-Naas', 'Al-Falaq', 'Al-Ikhlas'],
    akhlak:        ['Jujur', 'Hormat Orang Tua', 'Rajin Ibadah'],
    bacaan:        ['Tilawati Jilid 1', 'Tilawati Jilid 2'],
    makna_quran:   ['Makna Surat Al-Fatihah'],
    makna_hadis:   ['Hadis tentang Kebersihan'],
  },
  praremaja: {
    hafalan_doa:   ['Doa Qunut', 'Doa Selamat Dunia Akhirat'],
    hafalan_surat: ['Al-Kautsar', 'An-Nashr', 'Al-Kafirun'],
    akhlak:        ['Amanah', 'Disiplin', 'Peduli Sesama'],
    bacaan:        ['Tilawati Jilid 3', 'Tilawati Jilid 4'],
    makna_quran:   ['Makna Surat Al-Ikhlas'],
    makna_hadis:   ['Hadis tentang Menuntut Ilmu'],
  },
  remaja: {
    hafalan_doa:   ['Doa Setelah Adzan', 'Doa Ziarah Kubur'],
    hafalan_surat: ['Yasin (ayat 1-20)', 'Ar-Rahman (ayat 1-20)'],
    akhlak:        ['Tanggung Jawab', 'Menjaga Lisan', 'Kepemimpinan'],
    bacaan:        ['Al-Qur\u2019an Juz 1', 'Al-Qur\u2019an Juz 2'],
    makna_quran:   ['Makna Surat Yasin (ayat 1-10)'],
    makna_hadis:   ['Hadis tentang Silaturahmi'],
  },
  usianikah: {
    hafalan_doa:   ['Doa Walimah', 'Doa Rumah Tangga Sakinah'],
    hafalan_surat: ['Ar-Rum (ayat 21)', 'An-Nisa (ayat 1)'],
    akhlak:        ['Kesabaran Berumah Tangga', 'Musyawarah Keluarga'],
    bacaan:        ['Al-Qur\u2019an Juz 3-5 (lanjutan)'],
    makna_quran:   ['Makna Surat Ar-Rum ayat 21'],
    makna_hadis:   ['Hadis tentang Pernikahan'],
  },
};

// Pastikan item dummy default sudah ada di sheet (sekali saja, kalau kosong).
// Dipanggil dari /api/init bareng initializeSheets.
export async function seedDefaultTargetItems() {
  const existing = await readSheet(SHEETS.TARGET_ITEM);
  const sudahAdaDefault = existing.some(i => i.preset_id === DEFAULT_PRESET_ID);
  if (sudahAdaDefault) return;

  const rows = [];
  for (const tingkatan of URUTAN_TINGKATAN) {
    for (const kat of KATEGORI) {
      const items = DUMMY[tingkatan]?.[kat.key] || [];
      items.forEach((nama, idx) => {
        rows.push([generateId(), DEFAULT_PRESET_ID, tingkatan, kat.key, idx + 1, nama, new Date().toISOString()]);
      });
    }
  }
  if (rows.length === 0) return;
  await appendRows(SHEETS.TARGET_ITEM, rows);
}

// =============================================
// Preset yang lagi diikuti sebuah kelompok (fallback ke default kalau kosong)
// =============================================
export function resolvePresetId(kelompok) {
  return kelompok?.preset_id || DEFAULT_PRESET_ID;
}
