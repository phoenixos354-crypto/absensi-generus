import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, appendRow, SHEETS, generateId } from '@/lib/sheets';
import { generateDalilDariAI } from '@/lib/groq';
import { NextResponse } from 'next/server';

const JUMLAH_MASCOT = 5;

// Dalil cadangan yang SUDAH diverifikasi manual (bukan dari AI). Dipakai kalau
// AI gagal dipanggil, hasilnya tidak valid, atau modelnya sendiri tidak yakin
// (yakin: false) — jadi user tidak pernah melihat dalil yang belum tervalidasi.
const FALLBACK_DALIL = [
  {
    tipe: 'quran',
    teks_arab: 'وَلْيَخْشَ الَّذِينَ لَوْ تَرَكُوا مِنْ خَلْفِهِمْ ذُرِّيَّةً ضِعَافًا خَافُوا عَلَيْهِمْ فَلْيَتَّقُوا اللَّهَ وَلْيَقُولُوا قَوْلًا سَدِيدًا',
    teks_terjemah: 'Dan hendaklah takut kepada Allah orang-orang yang sekiranya meninggalkan keturunan yang lemah di belakang mereka, yang mereka khawatirkan kesejahteraannya. Maka bertakwalah kepada Allah, dan ucapkanlah perkataan yang benar.',
    sumber: 'QS. An-Nisa: 9',
  },
  {
    tipe: 'quran',
    teks_arab: 'يَا أَيُّهَا الَّذِينَ آمَنُوا قُوا أَنْفُسَكُمْ وَأَهْلِيكُمْ نَارًا',
    teks_terjemah: 'Wahai orang-orang yang beriman! Peliharalah dirimu dan keluargamu dari api neraka.',
    sumber: 'QS. At-Tahrim: 6',
  },
  {
    tipe: 'quran',
    teks_arab: 'يَا بُنَيَّ أَقِمِ الصَّلَاةَ وَأْمُرْ بِالْمَعْرُوفِ وَانْهَ عَنِ الْمُنكَرِ وَاصْبِرْ عَلَىٰ مَا أَصَابَكَ',
    teks_terjemah: 'Wahai anakku, laksanakanlah shalat, suruhlah (manusia) berbuat yang makruf, dan cegahlah (mereka) dari yang mungkar, dan bersabarlah terhadap apa yang menimpamu.',
    sumber: 'QS. Luqman: 17',
  },
  {
    tipe: 'hadis',
    teks_arab: 'كُلُّكُمْ رَاعٍ وَكُلُّكُمْ مَسْئُولٌ عَنْ رَعِيَّتِهِ',
    teks_terjemah: 'Setiap kalian adalah pemimpin (penanggung jawab), dan setiap kalian akan dimintai pertanggungjawaban atas apa yang dipimpinnya.',
    sumber: 'HR. Bukhari & Muslim',
  },
  {
    tipe: 'hadis',
    teks_arab: 'مُرُوا أَوْلَادَكُمْ بِالصَّلَاةِ وَهُمْ أَبْنَاءُ سَبْعِ سِنِينَ',
    teks_terjemah: 'Perintahkanlah anak-anak kalian untuk shalat ketika mereka berusia tujuh tahun.',
    sumber: 'HR. Abu Dawud',
  },
  {
    tipe: 'hadis',
    teks_arab: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
    teks_terjemah: 'Sebaik-baik kalian adalah orang yang mempelajari Al-Qur\'an dan mengajarkannya.',
    sumber: 'HR. Bukhari',
  },
  {
    tipe: 'hadis',
    teks_arab: 'إِذَا مَاتَ الْإِنْسَانُ انْقَطَعَ عَنْهُ عَمَلُهُ إِلَّا مِنْ ثَلَاثٍ: صَدَقَةٍ جَارِيَةٍ، أَوْ عِلْمٍ يُنْتَفَعُ بِهِ، أَوْ وَلَدٍ صَالِحٍ يَدْعُو لَهُ',
    teks_terjemah: 'Apabila seseorang meninggal dunia, terputuslah amalnya kecuali tiga perkara: sedekah jariyah, ilmu yang bermanfaat, atau anak saleh yang mendoakannya.',
    sumber: 'HR. Muslim',
  },
  {
    tipe: 'quran',
    teks_arab: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
    teks_terjemah: 'Ya Tuhan kami, anugerahkanlah kepada kami pasangan dan keturunan kami sebagai penyejuk hati (kami), dan jadikanlah kami imam (pemimpin/teladan) bagi orang-orang yang bertakwa.',
    sumber: 'QS. Al-Furqan: 74',
  },
  {
    tipe: 'quran',
    teks_arab: 'رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِنْ ذُرِّيَّتِي رَبَّنَا وَتَقَبَّلْ دُعَاءِ',
    teks_terjemah: 'Ya Tuhanku, jadikanlah aku dan anak cucuku orang-orang yang tetap mendirikan shalat. Ya Tuhan kami, perkenankanlah doaku.',
    sumber: 'QS. Ibrahim: 40',
  },
  {
    tipe: 'quran',
    teks_arab: 'فَخَلَفَ مِنْ بَعْدِهِمْ خَلْفٌ أَضَاعُوا الصَّلَاةَ وَاتَّبَعُوا الشَّهَوَاتِ فَسَوْفَ يَلْقَوْنَ غَيًّا',
    teks_terjemah: 'Kemudian datanglah setelah mereka, generasi pengganti yang menyia-nyiakan shalat dan memperturutkan hawa nafsunya, maka mereka kelak akan menemui kesesatan.',
    sumber: 'QS. Maryam: 59',
  },
  {
    tipe: 'hadis',
    teks_arab: 'كُلُّ مَوْلُودٍ يُولَدُ عَلَى الْفِطْرَةِ، فَأَبَوَاهُ يُهَوِّدَانِهِ أَوْ يُنَصِّرَانِهِ أَوْ يُمَجِّسَانِهِ',
    teks_terjemah: 'Setiap anak dilahirkan dalam keadaan fitrah (suci). Kedua orang tuanyalah yang menjadikannya Yahudi, Nasrani, atau Majusi.',
    sumber: 'HR. Bukhari & Muslim',
  },
];

function tanggalHariIni() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tanggal = tanggalHariIni();
  const semuaDalil = await readSheet(SHEETS.DALIL);
  const punyaHariIni = semuaDalil.find(d => d.tanggal === tanggal);

  if (punyaHariIni) {
    return NextResponse.json({
      tipe: punyaHariIni.tipe,
      teks_arab: punyaHariIni.teks_arab,
      teks_terjemah: punyaHariIni.teks_terjemah,
      sumber: punyaHariIni.sumber,
      mascot_index: Number(punyaHariIni.mascot_index) || 1,
    });
  }

  // Kumpulkan sumber-sumber yang sudah pernah ditampilkan (paling baru dulu), supaya
  // AI diminta menghindarinya dan fallback juga tidak mengulang dalil yang sama.
  const riwayatSumber = semuaDalil
    .slice()
    .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))
    .map(d => d.sumber)
    .filter(Boolean);
  const sumberBaruBaruIni = [...new Set(riwayatSumber)].slice(0, 15);

  // Belum ada cache untuk hari ini -> coba generate via AI (maksimal sekali per hari)
  const hasilAI = await generateDalilDariAI(sumberBaruBaruIni);

  // Fallback: pilih dalil cadangan yang sumbernya BELUM pernah dipakai baru-baru ini.
  // Kalau semua cadangan sudah pernah dipakai, baru boleh mengulang (pakai rotasi tanggal).
  const kandidatFallback = FALLBACK_DALIL.filter(d => !sumberBaruBaruIni.includes(d.sumber));
  const daftarFallback = kandidatFallback.length ? kandidatFallback : FALLBACK_DALIL;
  const fallback = daftarFallback[new Date(tanggal).getDate() % daftarFallback.length];

  const dipakai = hasilAI || fallback;
  const mascotIndex = (new Date(tanggal).getDate() % JUMLAH_MASCOT) + 1;

  try {
    await appendRow(SHEETS.DALIL, [
      generateId(), tanggal, dipakai.tipe, dipakai.teks_arab, dipakai.teks_terjemah, dipakai.sumber,
      String(mascotIndex), new Date().toISOString(),
    ]);
  } catch {
    // Kalau gagal simpan ke sheet, tetap kembalikan hasilnya ke user —
    // caching cuma optimisasi, bukan syarat untuk menampilkan dalil.
  }

  return NextResponse.json({
    tipe: dipakai.tipe,
    teks_arab: dipakai.teks_arab,
    teks_terjemah: dipakai.teks_terjemah,
    sumber: dipakai.sumber,
    mascot_index: mascotIndex,
  });
}
