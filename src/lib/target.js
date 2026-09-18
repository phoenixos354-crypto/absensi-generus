import { readSheet, appendRows, SHEETS, generateId } from '@/lib/sheets';
import { KATEGORI, URUTAN_TINGKATAN, DEFAULT_PRESET_ID, URUTAN_SUB_KELAS } from '@/lib/target-constants';

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
  mudamudi: {
    hafalan_doa:   ['Doa Kebaikan Dunia Akhirat', 'Doa Memohon Ilmu Bermanfaat'],
    hafalan_surat: ['Al-Mulk (ayat 1-10)', 'Al-Waqiah (ayat 1-20)'],
    akhlak:        ['Mandiri & Bertanggung Jawab', 'Menjaga Pergaulan', 'Semangat Menuntut Ilmu'],
    bacaan:        ['Al-Qur\u2019an Juz 5-10 (lanjutan)'],
    makna_quran:   ['Makna Surat Al-Mulk ayat 1-5'],
    makna_hadis:   ['Hadis tentang Pemuda & Ibadah'],
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

// =============================================
// KRITERIA KELULUSAN "NAIK KELAS"
// Dipakai oleh /api/kenaikan-kelas untuk menentukan saran "layak naik".
// PENTING: threshold ini HANYA SARAN awal (checkbox pre-checked di UI).
// Keputusan akhir selalu manual oleh guru — bisa override per murid.
// Kenaikan TIDAK PERNAH terjadi otomatis di background.
// =============================================
export const THRESHOLD_NAIK_DEFAULT = 80; // persen target ternilai dianggap "layak naik"

// Item target yang relevan untuk murid dengan tingkatan (+sub_kelas) saat ini:
// - tingkatan selain caberawit: semua item tingkatan itu (kolom kelas diabaikan)
// - caberawit: item yang kelasnya kosong (untuk semua kelas) ATAU sama
//   dengan sub_kelas murid — pola sama dengan filter target per kelas.
export function filterTargetItemsUntukMurid(items, tingkatan, subKelas) {
  const semua = (items || []).filter(i => i.tingkatan === tingkatan);
  if (tingkatan !== 'caberawit') return semua;
  return semua.filter(i => !i.kelas || i.kelas === (subKelas || ''));
}

// Hitung persentase target_item yang sudah DINILAI (nilai bukan 'belum')
// dibanding total target yang relevan untuk murid ini.
// progressByItem: Map item_id -> nilai terakhir murid (dari target_progress).
export function hitungProgressNaik(items, progressByItem) {
  const daftar = items || [];
  const total = daftar.length;
  const tercapai = daftar.filter(i => ((progressByItem && progressByItem.get(i.id)) || 'belum') !== 'belum').length;
  const persen = total > 0 ? Math.round((tercapai / total) * 100) : 0;
  return {
    tercapai,
    total,
    persen,
    // Kalau murid belum punya target sama sekali (total 0), JANGAN otomatis
    // dianggap layak — biarkan guru memutuskan lewat checkbox manual.
    layak: total > 0 && persen >= THRESHOLD_NAIK_DEFAULT,
  };
}

// Saran sub-kelas berikutnya sesuai urutan naik (paud_tk -> sd_1 -> ... -> sd_6).
// Null kalau sudah puncak / tidak ada sub_kelas tercatat (tidak ada saran).
export function saranSubKelasBerikutnya(subKelasSaatIni) {
  const idx = URUTAN_SUB_KELAS.indexOf(subKelasSaatIni || '');
  if (idx === -1 || idx >= URUTAN_SUB_KELAS.length - 1) return null;
  return URUTAN_SUB_KELAS[idx + 1];
}
