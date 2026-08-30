import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheet, readLatestByKey, SHEETS } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { resolvePresetId, KATEGORI } from '@/lib/target';
import { NextResponse } from 'next/server';

/**
 * GET /api/rekap-target?kelompok_id=...
 *
 * Rekap capaian target untuk SATU kelompok — analog dengan /api/rekap,
 * tapi berdasarkan target_item + target_progress, bukan absensi.
 * Target tidak punya "periode" (bukan data harian), jadi ini selalu
 * snapshot capaian saat ini.
 */
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kelompok_id = searchParams.get('kelompok_id');
  if (!kelompok_id) return NextResponse.json({ error: 'kelompok_id wajib diisi' }, { status: 400 });

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });

  const [kelompokList, muridAll, itemAll, progressAll] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.TARGET_ITEM),
    readLatestByKey(SHEETS.TARGET_PROGRESS, p => `${p.murid_id}|${p.item_id}`),
  ]);

  const kelompok = kelompokList.find(k => k.id === kelompok_id);
  if (!kelompok) return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 });

  const presetId = resolvePresetId(kelompok);
  const items = itemAll.filter(i => i.preset_id === presetId && i.tingkatan === kelompok.tingkatan);
  const murid = muridAll.filter(m => m.kelompok_id === kelompok_id);

  const progressByMurid = new Map();
  for (const p of progressAll) {
    if (!progressByMurid.has(p.murid_id)) progressByMurid.set(p.murid_id, new Map());
    progressByMurid.get(p.murid_id).set(p.item_id, p.nilai);
  }

  const rekapMurid = murid.map(m => {
    const pMap = progressByMurid.get(m.id) || new Map();
    const tercapai = items.filter(i => (pMap.get(i.id) || 'belum') !== 'belum').length;
    const total = items.length;
    const persen = total > 0 ? Math.round((tercapai / total) * 100) : null;
    return { murid_id: m.id, nama: m.nama_murid, tercapai, total, persen };
  });

  // Ringkasan per kategori — total slot = jumlah item kategori itu x jumlah murid,
  // tercapai = dijumlah dari semua murid. Ini gambaran "seberapa jauh kelompok
  // ini secara keseluruhan", bukan per-murid.
  const perKategori = KATEGORI.map(k => {
    const itemKategori = items.filter(i => i.kategori === k.key);
    let tercapai = 0;
    for (const m of murid) {
      const pMap = progressByMurid.get(m.id) || new Map();
      tercapai += itemKategori.filter(i => (pMap.get(i.id) || 'belum') !== 'belum').length;
    }
    const total = itemKategori.length * murid.length;
    return { key: k.key, label: k.label, tercapai, total };
  });

  const totalTercapai = rekapMurid.reduce((s, m) => s + m.tercapai, 0);
  const totalSlot = items.length * murid.length;
  const persenGlobal = totalSlot > 0 ? Math.round((totalTercapai / totalSlot) * 100) : 0;

  return NextResponse.json({
    kelompok_id,
    total_item: items.length,
    persen_global: persenGlobal,
    rekap_murid: rekapMurid,
    per_kategori: perKategori,
  });
}
