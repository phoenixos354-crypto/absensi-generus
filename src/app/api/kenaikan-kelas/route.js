import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  readSheet, readWhere, readWhereIn,
  updateRow, getSupabaseClient,
  SHEETS, generateId,
} from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import {
  resolvePresetId, filterTargetItemsUntukMurid, hitungProgressNaik,
  saranSubKelasBerikutnya, THRESHOLD_NAIK_DEFAULT,
} from '@/lib/target';
import { KELAS_CABERAWIT_LABEL, URUTAN_TINGKATAN } from '@/lib/target-constants';
import { NextResponse } from 'next/server';

// MURID_HEADERS harus sinkron dengan HEADERS[SHEETS.MURID] di src/lib/sheets.js
const MURID_HEADERS = ['id', 'kelompok_id', 'nama_murid', 'kode_publik', 'created_at', 'sub_kelas'];
// KELOMPOK_HEADERS harus sinkron dengan HEADERS[SHEETS.KELOMPOK] di src/lib/sheets.js
const KELOMPOK_HEADERS = ['id', 'user_id', 'nama_kelompok', 'tingkatan', 'desa', 'daerah', 'preset_id', 'created_at'];

// =============================================================
// GET /api/kenaikan-kelas?kelompok_id=...
// Daftar murid + status kelulusan (persen progress target) + saran
// kelompok/sub-kelas tujuan. MURNI BACA — tidak mengubah data apa pun.
// =============================================================
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  if (!kelompok_id) return NextResponse.json({ error: 'kelompok_id wajib diisi' }, { status: 400 });

  // Hanya owner yang boleh menjalankan kenaikan kelas
  // (pola sama seperti endpoint murid/target-item).
  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa mengelola kenaikan kelas' }, { status: 403 });

  const kelompokList = await readSheet(SHEETS.KELOMPOK);
  const kelompok = kelompokList.find(k => k.id === kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [murid, semuaItem] = await Promise.all([
    readWhere(SHEETS.MURID, { kelompok_id }),
    readSheet(SHEETS.TARGET_ITEM),
  ]);

  // Ambil semua baris progress murid-murid kelompok ini (filter di DB),
  // lalu ambil nilai TERAKHIR per (murid, item) — append-only.
  const muridIds = murid.map(m => m.id);
  const progressRows = muridIds.length > 0
    ? await readWhereIn(SHEETS.TARGET_PROGRESS, 'murid_id', muridIds)
    : [];

  const progressByMurid = new Map(); // murid_id -> Map(item_id -> nilai)
  for (const p of progressRows) {
    if (!progressByMurid.has(p.murid_id)) progressByMurid.set(p.murid_id, new Map());
    progressByMurid.get(p.murid_id).set(p.item_id, p.nilai);
  }

  const presetId = resolvePresetId(kelompok);
  const itemPreset = semuaItem.filter(i => i.preset_id === presetId);

  const saranKelompok = saranKelompokTujuan(kelompokList, kelompok);

  const hasil = murid.map(m => {
    const subSaatIni = m.sub_kelas || '';
    const pMap = progressByMurid.get(m.id) || new Map();

    // Progress terhadap target tingkatan+sub_kelas SAAT INI
    const itemsSaatIni = filterTargetItemsUntukMurid(itemPreset, kelompok.tingkatan, subSaatIni);
    const progres = hitungProgressNaik(itemsSaatIni, pMap);

    // Saran tujuan:
    // - caberawit: saran sub-kelas berikutnya (kalau masih ada urutan di atasnya)
    // - kalau sudah SD 6 / puncak, saran jadi naik tingkat besar
    const subBerikut = kelompok.tingkatan === 'caberawit' ? saranSubKelasBerikutnya(subSaatIni) : null;

    return {
      murid_id: m.id,
      nama_murid: m.nama_murid,
      sub_kelas: subSaatIni,
      sub_kelas_label: subSaatIni ? (KELAS_CABERAWIT_LABEL[subSaatIni] || subSaatIni) : '',
      jenis_saran: kelompok.tingkatan === 'caberawit' && subBerikut ? 'sub_kelas' : 'tingkat',
      saran_sub_kelas: subBerikut || '',
      saran_sub_kelas_label: subBerikut ? (KELAS_CABERAWIT_LABEL[subBerikut] || subBerikut) : '',
      tercapai: progres.tercapai,
      total: progres.total,
      persen: progres.persen,
      layak_saran: progres.layak, // SARAN awal (checkbox pre-checked); guru bisa override manual
      threshold: THRESHOLD_NAIK_DEFAULT,
    };
  });

  // Urutkan: yang paling siap di atas, lalu alfabetis
  hasil.sort((a, b) => (b.persen - a.persen) || a.nama_murid.localeCompare(b.nama_murid, 'id'));

  return NextResponse.json({
    kelompok: {
      id: kelompok.id,
      nama_kelompok: kelompok.nama_kelompok,
      tingkatan: kelompok.tingkatan,
      kelompok_tujuan_id: kelompok.kelompok_tujuan_id || '',
    },
    kelompok_tujuan: saranKelompok
      ? { id: saranKelompok.id, nama_kelompok: saranKelompok.nama_kelompok, tingkatan: saranKelompok.tingkatan }
      : null,
    murid: hasil,
    threshold: THRESHOLD_NAIK_DEFAULT,
  });
}

// =============================================================
// POST /api/kenaikan-kelas
// Naikkan murid yang DIPILIH guru SECARA MASSAL dalam SATU transaksi,
// lalu catat tiap perubahan ke riwayat_kenaikan_kelas.
//   { kelompok_id, jenis: 'sub_kelas' | 'tingkat',
//     ke_sub_kelas?: 'sd_2' (untuk jenis=sub_kelas),
//     ke_kelompok_id?: 'xxx' (untuk jenis=tingkat) }
// =============================================================
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, jenis, ke_sub_kelas, ke_kelompok_id, murid_ids } = await req.json();

  if (!kelompok_id || !murid_ids || !Array.isArray(murid_ids) || murid_ids.length === 0) {
    return NextResponse.json({ error: 'kelompok_id dan murid_ids wajib diisi' }, { status: 400 });
  }
  if (jenis !== 'sub_kelas' && jenis !== 'tingkat') {
    return NextResponse.json({ error: "jenis harus 'sub_kelas' atau 'tingkat'" }, { status: 400 });
  }

  // Hanya owner
  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa mengelola kenaikan kelas' }, { status: 403 });

  const kelompokList = await readSheet(SHEETS.KELOMPOK);
  const kelompok = kelompokList.find(k => k.id === kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Kelompok tujuan wajib kelompok lain milik owner ini (untuk jenis 'tingkat')
  let tujuan = null;
  if (jenis === 'tingkat') {
    if (!ke_kelompok_id) return NextResponse.json({ error: 'ke_kelompok_id wajib diisi untuk naik tingkat' }, { status: 400 });
    if (ke_kelompok_id === kelompok_id) {
      return NextResponse.json({ error: 'Kelompok tujuan tidak boleh kelompok itu sendiri' }, { status: 400 });
    }
    tujuan = kelompokList.find(k => k.id === ke_kelompok_id && k.user_id === kelompok.user_id);
    if (!tujuan) return NextResponse.json({ error: 'Kelompok tujuan tidak ditemukan / bukan milik Anda' }, { status: 400 });
  }

  const muridSemua = await readWhereIn(SHEETS.MURID, 'kelompok_id', [kelompok_id]);
  const dipilihMap = new Map(muridSemua.map(m => [m.id, m]));

  // Validasi semua murid yang diminta benar-benar milik kelompok ini
  const tidakAda = murid_ids.filter(id => !dipilihMap.has(id));
  if (tidakAda.length > 0) {
    return NextResponse.json({ error: 'Ada murid yang tidak termasuk kelompok ini' }, { status: 400 });
  }

  // Untuk 'sub_kelas', pakai saran sub-kelas berikutnya kalau ke_sub_kelas
  // tidak dikirim (tetap BISA di-override manual dari UI wizard).
  let subTujuan = '';
  if (jenis === 'sub_kelas') {
    subTujuan = ke_sub_kelas || '';
    if (!subTujuan) {
      const sarannya = new Set(
        murid_ids.map(id => saranSubKelasBerikutnya(dipilihMap.get(id).sub_kelas || '')).filter(Boolean)
      );
      if (sarannya.size === 1) subTujuan = [...sarannya][0];
    }
    if (!subTujuan) {
      return NextResponse.json({ error: 'ke_sub_kelas wajib diisi (ada murid tanpa kelas / sudah kelas 6)' }, { status: 400 });
    }
  }

  // =============================================================
  // SATU TRANSAKSI POSTGRES (RPC naikkan_kelas_massal, lihat
  // supabase/migrasi-kenaikan-kelas.sql): update semua murid yang dipilih
  // + catat riwayat ATOMIK — kalau satu saja gagal, SEMUA dibatalkan
  // (tidak ada murid "naik setengah jalan").
  // =============================================================
  const now = new Date();
  const tanggalLokal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const riwayatIds = murid_ids.map(() => generateId());

  const { data: jumlahNaik, error } = await getSupabaseClient().rpc('naikkan_kelas_massal', {
    p_murid_ids: murid_ids,
    p_riwayat_ids: riwayatIds,
    p_jenis: jenis,
    p_dari_kelompok_id: kelompok_id,
    p_ke_kelompok_id: jenis === 'tingkat' ? tujuan.id : kelompok_id,
    p_ke_sub_kelas: jenis === 'sub_kelas' ? subTujuan : '',
    p_tanggal: tanggalLokal,
    p_dicatat_oleh: session.user.email,
    p_created_at: now.toISOString(),
  });

  if (error) {
    return NextResponse.json({
      error: 'Gagal menjalankan kenaikan. TIDAK ada data yang berubah — coba lagi.',
      detail: error.message,
    }, { status: 500 });
  }

  // Ringkasan hasil untuk UI (dibentuk dari data sebelum update)
  const hasilMurid = murid_ids.map((id, i) => {
    const m = dipilihMap.get(id);
    return {
      murid_id: id,
      nama_murid: m.nama_murid,
      dari_sub_kelas: m.sub_kelas || '',
      ke_sub_kelas: jenis === 'sub_kelas' ? subTujuan : '',
      kelompok_id: jenis === 'tingkat' ? tujuan.id : kelompok_id,
      riwayat_id: riwayatIds[i],
    };
  });

  return NextResponse.json({
    success: true,
    jenis,
    jumlah: jumlahNaik ?? hasilMurid.length,
    ke_kelompok: tujuan ? { id: tujuan.id, nama_kelompok: tujuan.nama_kelompok } : { id: kelompok_id, nama_kelompok: kelompok.nama_kelompok },
    ke_sub_kelas: jenis === 'sub_kelas' ? subTujuan : '',
    ke_sub_kelas_label: jenis === 'sub_kelas' && subTujuan ? (KELAS_CABERAWIT_LABEL[subTujuan] || subTujuan) : '',
    murid: hasilMurid,
  });
}

// =============================================================
// PUT /api/kenaikan-kelas  { kelompok_id, kelompok_tujuan_id }
// Simpan pilihan kelompok tujuan (langkah 1 wizard). Kolom ini ADDITIVE
// dan nullable — kelompok yang belum memilih tetap NULL seperti sebelumnya.
// =============================================================
export async function PUT(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kelompok_id, kelompok_tujuan_id } = await req.json();
  if (!kelompok_id) return NextResponse.json({ error: 'kelompok_id wajib diisi' }, { status: 400 });

  const perm = await getPermission(session.user.email, kelompok_id);
  if (perm !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa mengelola kenaikan kelas' }, { status: 403 });

  const kelompokList = await readSheet(SHEETS.KELOMPOK);
  const target = kelompokList.find(k => k.id === kelompok_id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Kalau mengisi (bukan kosong), pastikan tujuannya kelompok lain milik owner ini
  if (kelompok_tujuan_id) {
    if (kelompok_tujuan_id === kelompok_id) {
      return NextResponse.json({ error: 'Kelompok tujuan tidak boleh kelompok itu sendiri' }, { status: 400 });
    }
    const tujuan = kelompokList.find(k => k.id === kelompok_tujuan_id && k.user_id === target.user_id);
    if (!tujuan) return NextResponse.json({ error: 'Kelompok tujuan tidak ditemukan / bukan milik Anda' }, { status: 400 });
  }

  await updateRow(SHEETS.KELOMPOK, { ...target, kelompok_tujuan_id: kelompok_tujuan_id || '' }, KELOMPOK_HEADERS);
  return NextResponse.json({ success: true, kelompok_tujuan_id: kelompok_tujuan_id || '' });
}

// =============================================================
// Helper: saran kelompok tujuan = kelompok milik owner yang sama
// dengan tingkatan SATU tingkat lebih tinggi (URUTAN_TINGKATAN).
// =============================================================
function saranKelompokTujuan(kelompokList, kelompok) {
  const idxSaatIni = URUTAN_TINGKATAN.indexOf(kelompok.tingkatan);
  if (idxSaatIni === -1 || idxSaatIni >= URUTAN_TINGKATAN.length - 1) return null;
  const tingkatanBerikut = URUTAN_TINGKATAN[idxSaatIni + 1];
  const kandidat = kelompokList.filter(k => k.user_id === kelompok.user_id && k.tingkatan === tingkatanBerikut && k.id !== kelompok.id);
  if (kandidat.length === 0) return null;
  // Ambil yang paling dekat (sama desa lebih dulu)
  const samaDesa = kandidat.find(k => k.desa === kelompok.desa);
  return samaDesa || kandidat[0];
}
