// =============================================
// Generate dalil (Al-Qur'an / 6 kitab hadis utama) tentang "generasi penerus"
// lewat Groq (model openai/gpt-oss-120b), dengan pengaman terhadap halusinasi:
//
// 1. Prompt secara eksplisit melarang model mengarang teks/rujukan, dan
//    mewajibkan model menolak (yakin: false) kalau tidak benar-benar yakin.
// 2. Hasil divalidasi ketat (field wajib ada, "yakin" harus true) sebelum dipakai.
// 3. Kalau API gagal / hasil tidak valid / model tidak yakin, caller (route
//    /api/dalil-hari-ini) akan jatuh ke daftar cadangan yang sudah diverifikasi
//    manual — bukan menampilkan apa pun yang belum tervalidasi.
// 4. Dipanggil MAKSIMAL sekali per hari (di-cache di sheet dalil_harian),
//    bukan tiap kali halaman dibuka.
// =============================================

const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `Kamu adalah asisten yang SANGAT hati-hati soal keakuratan dalil agama Islam.

Sumber yang BOLEH kamu kutip HANYA:
- Al-Qur'an
- Shahih Muslim
- Shahih Bukhari
- Sunan Ibnu Majah
- Sunan Abu Dawud
- Sunan Tirmidzi
- Sunan Nasa'i

Tugas: berikan SATU dalil (ayat Al-Qur'an atau hadis) yang benar-benar terkenal luas dan mudah diverifikasi, khusus bertema "generasi penerus" — mendidik anak, menjaga keturunan, tanggung jawab terhadap anak/murid, regenerasi umat, mewariskan ilmu.

ATURAN KETAT (WAJIB DIPATUHI):
- HANYA berikan dalil yang kamu benar-benar yakin teks dan rujukannya akurat. JANGAN PERNAH mengarang, menebak, atau menggabungkan dua sumber berbeda.
- Kalau kamu tidak 100% yakin dengan teks Arab, terjemahan, atau nomor rujukannya — JANGAN memaksakan jawaban. Balas {"yakin": false} saja.
- Rujukan harus spesifik dan bisa ditelusuri, contoh: "QS. An-Nisa: 9" atau "HR. Muslim, no. 1631".
- Jangan mengarang nomor ayat/hadis kalau kamu tidak yakin persis nomornya — lebih baik sebut nama suratnya saja / "HR. Bukhari" tanpa nomor, daripada nomor yang salah.

Balas HANYA dengan JSON murni, tanpa teks lain, tanpa markdown, salah satu dari dua bentuk:
{"yakin": true, "tipe": "quran" atau "hadis", "teks_arab": "...", "teks_terjemah": "...", "sumber": "..."}
{"yakin": false}`;

export async function generateDalilDariAI() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  let res;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: 'Berikan satu dalil bertema generasi penerus. Kalau tidak 100% yakin, jawab {"yakin": false}.' },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      }),
    });
  } catch {
    return null; // network/timeout — biarkan caller fallback
  }

  if (!res.ok) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null; // model tidak balas JSON valid — jangan dipaksakan
  }

  if (!parsed || parsed.yakin !== true) return null;
  if (!parsed.teks_terjemah || !parsed.sumber || !parsed.tipe) return null;
  if (!['quran', 'hadis'].includes(parsed.tipe)) return null;

  return {
    tipe: parsed.tipe,
    teks_arab: typeof parsed.teks_arab === 'string' ? parsed.teks_arab : '',
    teks_terjemah: String(parsed.teks_terjemah),
    sumber: String(parsed.sumber),
  };
}
