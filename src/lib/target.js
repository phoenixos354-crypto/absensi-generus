import { readSheet, appendRow, SHEETS, generateId } from '@/lib/sheets';
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
  for (const row of rows) {
    await appendRow(SHEETS.TARGET_ITEM, row);
  }
}

// =============================================
// Preset yang lagi diikuti sebuah kelompok (fallback ke default kalau kosong)
// =============================================
export function resolvePresetId(kelompok) {
  return kelompok?.preset_id || DEFAULT_PRESET_ID;
}

// =============================================
// JARINGAN: kelompok mana saja yang "saling kenal" (transitif lewat orang
// yang sama jadi owner/admin di beberapa kelompok). Dipakai buat nentuin
// preset siapa saja yang boleh di-browse & diikuti oleh sebuah kelompok.
// =============================================
export async function getKelompokTerhubung(kelompokId) {
  const [semuaKelompok, semuaAdmin] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.ADMIN_KELOMPOK),
  ]);

  const emailOwner = (kId) => {
    const k = semuaKelompok.find(x => x.id === kId);
    // owner disimpan sbg user_id di kelompok, sedang admin_kelompok pakai email.
    // owner selalu ikut tercatat juga sbg baris 'owner' di admin_kelompok saat kelompok dibuat.
    return semuaAdmin.filter(a => a.kelompok_id === kId).map(a => a.email);
  };

  const visitedKelompok = new Set([kelompokId]);
  const visitedEmail = new Set(emailOwner(kelompokId));
  let frontierEmail = [...visitedEmail];
  let hop = 0;

  while (frontierEmail.length > 0 && hop < 5) {
    const kelompokBaru = semuaAdmin
      .filter(a => frontierEmail.includes(a.email) && !visitedKelompok.has(a.kelompok_id))
      .map(a => a.kelompok_id);

    const uniqueBaru = [...new Set(kelompokBaru)];
    if (uniqueBaru.length === 0) break;

    const emailBaru = new Set();
    for (const kId of uniqueBaru) {
      visitedKelompok.add(kId);
      for (const em of emailOwner(kId)) {
        if (!visitedEmail.has(em)) { visitedEmail.add(em); emailBaru.add(em); }
      }
    }
    frontierEmail = [...emailBaru];
    hop++;
  }

  return [...visitedKelompok];
}

// Semua preset yang boleh dilihat/diikuti sebuah kelompok: Default + preset
// yang dibuat oleh kelompok-kelompok dalam jaringannya.
export async function getPresetTerlihat(kelompokId) {
  const [kelompokTerhubung, semuaPreset] = await Promise.all([
    getKelompokTerhubung(kelompokId),
    readSheet(SHEETS.TARGET_PRESET),
  ]);

  const preset = semuaPreset.filter(p => kelompokTerhubung.includes(p.dibuat_oleh_kelompok_id));
  return [
    { id: DEFAULT_PRESET_ID, nama_preset: 'Target Default', nama_kelompok_asal: 'Bawaan Aplikasi', desa_asal: '', daerah_asal: '', dibuat_oleh_kelompok_id: null },
    ...preset,
  ];
}
