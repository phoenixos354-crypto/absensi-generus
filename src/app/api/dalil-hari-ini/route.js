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

  // Belum ada cache untuk hari ini -> coba generate via AI (maksimal sekali per hari)
  const hasilAI = await generateDalilDariAI();
  const dipakai = hasilAI || FALLBACK_DALIL[new Date(tanggal).getDate() % FALLBACK_DALIL.length];
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
