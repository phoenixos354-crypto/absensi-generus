import { readSheet, readLatestByKeyWhereIn, SHEETS } from '@/lib/sheets';
import { resolvePresetId, KATEGORI } from '@/lib/target';
import { NextResponse } from 'next/server';

/**
 * GET /api/public/rekap-target/[id]
 * Public endpoint — no auth required.
 * Rekap capaian target SATU kelompok (snapshot saat ini, tanpa periode).
 * Dipakai halaman layar/proyektor /public/rekap-target/[id].
 */
export async function GET(req, { params }) {
  const kelompokId = params.id;

  const [kelompokList, muridAll, itemAll] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.TARGET_ITEM),
  ]);

  const kelompok = kelompokList.find(k => k.id === kelompokId);
  if (!kelompok) {
    return NextResponse.json({ error: 'Kelompok tidak ditemukan' }, { status: 404 });
  }

  const presetId = resolvePresetId(kelompok);
  const items = itemAll.filter(i => i.preset_id === presetId && i.tingkatan === kelompok.tingkatan);
  const murid = muridAll.filter(m => m.kelompok_id === kelompokId);

  const muridIds = murid.map(m => m.id);
  const progressAll = muridIds.length > 0
    ? await readLatestByKeyWhereIn(SHEETS.TARGET_PROGRESS, 'murid_id', muridIds, p => `${p.murid_id}|${p.item_id}`)
    : [];

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
    kelompok_id: kelompokId,
    kelompok_nama: kelompok.nama_kelompok,
    tingkatan: kelompok.tingkatan,
    desa: kelompok.desa,
    daerah: kelompok.daerah,
    total_item: items.length,
    persen_global: persenGlobal,
    rekap_murid: rekapMurid,
    per_kategori: perKategori,
  });
}
