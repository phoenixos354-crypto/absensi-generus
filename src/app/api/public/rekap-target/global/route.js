import { readSheet, readLatestByKeyWhereIn, SHEETS } from '@/lib/sheets';
import { resolvePresetId } from '@/lib/target';
import { TINGKATAN_MUDA_I } from '@/lib/target-constants';
import { NextResponse } from 'next/server';

/**
 * GET /api/public/rekap-target/global?tingkatan=semua&kelompok_ids=a,b,c
 * Public endpoint — no auth required.
 * Gabungan capaian target kelompok yang disebut di kelompok_ids
 * (supaya tidak bocor semua data). Dipakai halaman layar/proyektor
 * /public/rekap-target/global.
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const tingkatanFilter = searchParams.get('tingkatan') || 'semua';
  const kelompokIdsParam = searchParams.get('kelompok_ids');

  let allGroups = await readSheet(SHEETS.KELOMPOK);
  if (kelompokIdsParam) {
    const ids = kelompokIdsParam.split(',').filter(Boolean);
    allGroups = allGroups.filter(k => ids.includes(k.id));
  }
  if (!allGroups.length) {
    return NextResponse.json({
      stats: { total_murid: 0, tercapai_100: 0, avg_persen: 0, kelompok_aktif: 0, total_tercapai: 0 },
      tingkatan_counts: {},
      kategori_counts: { caberawit: 0, mudai: 0 },
      kelompok_list: [],
      top_murid: [],
    });
  }

  const [muridAll, itemAll] = await Promise.all([
    readSheet(SHEETS.MURID),
    readSheet(SHEETS.TARGET_ITEM),
  ]);

  const kelompokIds = new Set(allGroups.map(k => k.id));
  const muridIds = muridAll.filter(m => kelompokIds.has(m.kelompok_id)).map(m => m.id);
  const progressAll = muridIds.length > 0
    ? await readLatestByKeyWhereIn(SHEETS.TARGET_PROGRESS, 'murid_id', muridIds, p => `${p.murid_id}|${p.item_id}`)
    : [];

  const progressByMurid = new Map();
  for (const p of progressAll) {
    if (!progressByMurid.has(p.murid_id)) progressByMurid.set(p.murid_id, new Map());
    progressByMurid.get(p.murid_id).set(p.item_id, p.nilai);
  }

  const tingkatanCounts = {};
  for (const k of allGroups) {
    const jumlahMurid = muridAll.filter(m => m.kelompok_id === k.id).length;
    tingkatanCounts[k.tingkatan] = (tingkatanCounts[k.tingkatan] || 0) + jumlahMurid;
  }

  const kategoriCounts = { caberawit: 0, mudai: 0 };
  for (const k of allGroups) {
    const jumlahMurid = muridAll.filter(m => m.kelompok_id === k.id).length;
    if (k.tingkatan === 'caberawit') kategoriCounts.caberawit += jumlahMurid;
    else if (TINGKATAN_MUDA_I.includes(k.tingkatan)) kategoriCounts.mudai += jumlahMurid;
  }

  const kelompokList = tingkatanFilter === 'semua'
    ? allGroups
    : tingkatanFilter === 'mudai'
      ? allGroups.filter(k => TINGKATAN_MUDA_I.includes(k.tingkatan))
      : allGroups.filter(k => k.tingkatan === tingkatanFilter);

  const kelompokRekap = [];
  const topMurid = [];

  let totalMuridGlobal = 0;
  let totalTercapaiGlobal = 0;
  let totalSlotGlobal = 0;
  let tercapai100Global = 0;
  let kelompokAktif = 0;

  for (const k of kelompokList) {
    const presetId = resolvePresetId(k);
    const items = itemAll.filter(i => i.preset_id === presetId && i.tingkatan === k.tingkatan);
    const muridKelompok = muridAll.filter(m => m.kelompok_id === k.id);

    totalMuridGlobal += muridKelompok.length;

    let tercapaiKelompok = 0;
    let adaProgress = false;

    for (const m of muridKelompok) {
      const pMap = progressByMurid.get(m.id) || new Map();
      if (pMap.size > 0) adaProgress = true;
      const tercapai = items.filter(i => (pMap.get(i.id) || 'belum') !== 'belum').length;
      const total = items.length;
      const persenMurid = total > 0 ? Math.round((tercapai / total) * 100) : null;

      tercapaiKelompok += tercapai;

      if (persenMurid === 100) {
        tercapai100Global += 1;
        topMurid.push({
          murid_id: m.id,
          nama: m.nama_murid,
          kelompok_id: k.id,
          nama_kelompok: k.nama_kelompok,
          tingkatan: k.tingkatan,
          persen: persenMurid,
        });
      }
    }

    if (adaProgress) kelompokAktif += 1;

    const slotKelompok = items.length * muridKelompok.length;
    totalTercapaiGlobal += tercapaiKelompok;
    totalSlotGlobal += slotKelompok;

    const persenKelompok = slotKelompok > 0 ? Math.round((tercapaiKelompok / slotKelompok) * 100) : null;

    kelompokRekap.push({
      id: k.id,
      nama_kelompok: k.nama_kelompok,
      tingkatan: k.tingkatan,
      desa: k.desa,
      daerah: k.daerah,
      persen: persenKelompok,
      total_murid: muridKelompok.length,
      total_item: items.length,
    });
  }

  kelompokRekap.sort((a, b) => (b.persen ?? -1) - (a.persen ?? -1));

  const urutanKelompok = new Map(kelompokRekap.map((k, i) => [k.id, i]));
  topMurid.sort((a, b) => {
    const ra = urutanKelompok.get(a.kelompok_id) ?? 999;
    const rb = urutanKelompok.get(b.kelompok_id) ?? 999;
    if (ra !== rb) return ra - rb;
    return String(a.nama || '').localeCompare(String(b.nama || ''), 'id');
  });

  const avgPersen = totalSlotGlobal > 0 ? Math.round((totalTercapaiGlobal / totalSlotGlobal) * 100) : 0;

  return NextResponse.json({
    stats: {
      total_murid: totalMuridGlobal,
      tercapai_100: tercapai100Global,
      avg_persen: avgPersen,
      kelompok_aktif: kelompokAktif,
      total_tercapai: totalTercapaiGlobal,
    },
    tingkatan_counts: tingkatanCounts,
    kategori_counts: kategoriCounts,
    kelompok_list: kelompokRekap,
    top_murid: topMurid,
  });
}
