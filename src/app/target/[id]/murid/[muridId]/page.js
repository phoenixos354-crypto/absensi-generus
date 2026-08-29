'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { KATEGORI, URUTAN_TINGKATAN, NILAI_LIST, NILAI_WARNA, NILAI_LABEL, NILAI_DOT } from '@/lib/target-constants';
import { pilihNilaiLocalFirst, mergeOverlay, flushPending } from '@/lib/localOverlay';
import { ChevronLeft, Share2, ChevronDown, Check, CalendarCheck, ChevronRight as ChevronRightIcon, Target as TargetIcon } from 'lucide-react';

function bulanIniStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function labelBulan(nilai) {
  const [y, m] = nilai.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function geserBulan(nilai, delta) {
  const [y, m] = nilai.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function KartuTargetPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;
  const muridId = params.muridId;

  const [kategoriAktif, setKategoriAktif] = useState(KATEGORI[0].key);
  const [bukaTunggakan, setBukaTunggakan] = useState(false);
  const [popupItem, setPopupItem] = useState(null); // { id, nama_item }
  const [copied, setCopied] = useState(false);
  const [bulanDipilih, setBulanDipilih] = useState(bulanIniStr());

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  // Begitu halaman dibuka, coba kirim ulang nilai-nilai yang sempat gagal
  // sync di sesi sebelumnya (misal: app ditutup sebelum request selesai).
  useEffect(() => {
    if (muridId) flushPending(muridId);
  }, [muridId]);

  const { data: kelompok } = useSWR(session && kelompokId ? `/api/kelompok/${kelompokId}` : null);
  const { data: itemData } = useSWR(session && kelompokId ? `/api/target-item?kelompok_id=${kelompokId}` : null);
  const { data: progress } = useSWR(session && muridId ? `/api/target-progress?murid_id=${muridId}` : null);
  const { data: rekapBulan, isLoading: loadingRekap } = useSWR(
    session && kelompokId && bulanDipilih ? `/api/rekap?kelompok_id=${kelompokId}&mode=bulan&nilai=${bulanDipilih}` : null
  );
  const { data: rekapTotal } = useSWR(
    session && kelompokId ? `/api/rekap?kelompok_id=${kelompokId}` : null
  );

  const murid = kelompok?.murid?.find(m => m.id === muridId);
  const tingkatan = kelompok?.tingkatan;
  const items = itemData?.items || [];
  const progressMap = useMemo(() => {
    // Timpa data server dengan nilai lokal yang masih "pending" sync,
    // supaya tampilan selalu nunjukin pilihan terakhir user — walau
    // request ke server belum selesai atau baru saja reload halaman.
    const progressGabungan = muridId ? mergeOverlay(progress, muridId) : (progress || []);
    const m = {};
    progressGabungan.forEach(p => { m[p.item_id] = p.nilai; });
    return m;
  }, [progress, muridId]);

  const kehadiranBulanIni = rekapBulan?.rekap_murid?.find(r => r.murid_id === muridId);
  const kehadiranTotal = rekapTotal?.rekap_murid?.find(r => r.murid_id === muridId);

  // Ringkasan target: seluruh kategori untuk jenjang murid ini
  const statPerKategori = useMemo(() => {
    return KATEGORI.map(k => {
      const its = items.filter(i => i.tingkatan === tingkatan && i.kategori === k.key);
      const tercapai = its.filter(i => (progressMap[i.id] || 'belum') !== 'belum').length;
      return { key: k.key, label: k.label, tercapai, total: its.length };
    });
  }, [items, tingkatan, progressMap]);

  const totalItemSemua = statPerKategori.reduce((s, k) => s + k.total, 0);
  const totalTercapaiSemua = statPerKategori.reduce((s, k) => s + k.tercapai, 0);
  const persenTarget = totalItemSemua > 0 ? Math.round((totalTercapaiSemua / totalItemSemua) * 100) : 0;

  const itemKategoriIni = items
    .filter(i => i.tingkatan === tingkatan && i.kategori === kategoriAktif)
    .sort((a, b) => Number(a.urutan) - Number(b.urutan));

  const idxTingkatan = URUTAN_TINGKATAN.indexOf(tingkatan);
  const itemTunggakan = items.filter(i =>
    i.kategori === kategoriAktif &&
    URUTAN_TINGKATAN.indexOf(i.tingkatan) < idxTingkatan &&
    URUTAN_TINGKATAN.indexOf(i.tingkatan) >= 0 &&
    (progressMap[i.id] || 'belum') === 'belum'
  );

  function pilihNilai(itemId, nilai) {
    setPopupItem(null);
    const key = `/api/target-progress?murid_id=${muridId}`;

    // Simpan ke localStorage dulu (instan, tidak nunggu jaringan sama
    // sekali) lalu kirim ke server di background — fungsi ini SENGAJA
    // tidak di-await, biar UI tidak pernah ke-block nunggu Google Sheets.
    pilihNilaiLocalFirst(muridId, itemId, nilai);

    // Update tampilan langsung (SWR cache di memori, biar re-render instan)
    mutate(key, (current) => {
      const list = current ? [...current] : [];
      const idx = list.findIndex(p => p.item_id === itemId);
      if (idx >= 0) list[idx] = { ...list[idx], nilai };
      else list.push({ item_id: itemId, nilai });
      return list;
    }, false);
  }

  async function salinLink() {
    const res = await fetch(`/api/murid/kode-publik?murid_id=${muridId}`);
    const data = await res.json();
    if (data.kode_publik) {
      const url = `${window.location.origin}/p/${data.kode_publik}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!kelompok || !murid) {
    return (
      <AppScreen>
        <div className="space-y-4 px-5 pt-8">
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-40 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        </div>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <header className="flex items-center justify-between px-5 pt-6">
        <button
          onClick={() => router.push(`/target/${kelompokId}`)}
          aria-label="Kembali"
          className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
        >
          <ChevronLeft className="size-5 text-ink" />
        </button>
        <button
          onClick={salinLink}
          className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-xs font-bold text-ink shadow-[var(--shadow-card)]"
        >
          <Share2 className="size-4" /> {copied ? 'Tersalin!' : 'Salin Link'}
        </button>
      </header>

      <section className="px-5 pt-4">
        <h1 className="text-xl font-extrabold text-ink">{murid.nama_murid}</h1>
        <p className="text-xs font-semibold text-muted-foreground">{kelompok.nama_kelompok}</p>
      </section>

      {/* Kehadiran per bulan */}
      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
              <CalendarCheck className="size-4 text-primary" /> Kehadiran
            </h2>
            <div className="flex items-center gap-1">
              <button
                aria-label="Bulan sebelumnya"
                onClick={() => setBulanDipilih(b => geserBulan(b, -1))}
                className="grid size-7 place-items-center rounded-full bg-secondary text-ink"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="min-w-[7.5rem] text-center text-xs font-bold text-ink">{labelBulan(bulanDipilih)}</span>
              <button
                aria-label="Bulan berikutnya"
                onClick={() => setBulanDipilih(b => geserBulan(b, 1))}
                disabled={bulanDipilih >= bulanIniStr()}
                className="grid size-7 place-items-center rounded-full bg-secondary text-ink disabled:opacity-30"
              >
                <ChevronRightIcon className="size-3.5" />
              </button>
            </div>
          </div>

          {loadingRekap ? (
            <div className="mt-3 h-16 animate-pulse rounded-2xl bg-muted" />
          ) : !kehadiranBulanIni || kehadiranBulanIni.total === 0 ? (
            <p className="mt-3 text-center text-sm text-muted-foreground">Belum ada data absensi di bulan ini.</p>
          ) : (
            <>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Masuk {kehadiranBulanIni.hadir} dari {kehadiranBulanIni.total} sesi</span>
                <span className="text-lg font-extrabold text-primary">{kehadiranBulanIni.persen_hadir}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${kehadiranBulanIni.persen_hadir}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">Hadir: {kehadiranBulanIni.hadir}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">Izin: {kehadiranBulanIni.izin}</span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold text-sky-700">Sakit: {kehadiranBulanIni.sakit}</span>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-700">Alfa: {kehadiranBulanIni.alfa}</span>
              </div>
            </>
          )}

          {kehadiranTotal && kehadiranTotal.total > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-[11px] font-semibold text-muted-foreground">Total keseluruhan (sejak awal)</span>
              <span className="text-xs font-extrabold text-ink">
                {kehadiranTotal.hadir} dari {kehadiranTotal.total} sesi &middot; {kehadiranTotal.persen_hadir}%
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Ringkasan target keseluruhan */}
      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <TargetIcon className="size-4 text-primary" /> Ringkasan Target
          </h2>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tercapai {totalTercapaiSemua} dari {totalItemSemua} target</span>
            <span className="text-lg font-extrabold text-primary">{persenTarget}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${persenTarget}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {statPerKategori.map(k => (
              <button
                key={k.key}
                onClick={() => setKategoriAktif(k.key)}
                className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left ${
                  kategoriAktif === k.key ? 'bg-ink text-primary-foreground' : 'bg-secondary text-ink'
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{k.label}</span>
                <span className={`shrink-0 text-[11px] font-extrabold ${kategoriAktif === k.key ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                  {k.tercapai}/{k.total}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <p className="px-5 pt-4 text-xs font-bold text-muted-foreground">Detail per kategori</p>

      {/* Tab kategori */}
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {KATEGORI.map(k => (
          <button
            key={k.key}
            onClick={() => setKategoriAktif(k.key)}
            className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-bold transition-colors ${
              kategoriAktif === k.key ? 'bg-ink text-primary-foreground' : 'bg-surface text-muted-foreground shadow-[var(--shadow-card)]'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Banner tunggakan */}
      {itemTunggakan.length > 0 && (
        <div className="mx-5 mt-4 overflow-hidden rounded-2xl bg-amber-50">
          <button
            onClick={() => setBukaTunggakan(v => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="text-xs font-bold text-amber-800">
              &#9888;&#65039; {itemTunggakan.length} target dari jenjang bawah belum tuntas
            </span>
            <ChevronDown className={`size-4 shrink-0 text-amber-700 transition-transform ${bukaTunggakan ? 'rotate-180' : ''}`} />
          </button>
          {bukaTunggakan && (
            <ul className="divide-y divide-amber-100 border-t border-amber-100 px-4">
              {itemTunggakan.map(i => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{i.nama_item}</span>
                  <button
                    onClick={() => setPopupItem(i)}
                    className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-amber-800"
                  >
                    Tandai
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Daftar item kategori aktif */}
      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          {itemKategoriIni.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Belum ada daftar target untuk kategori ini di jenjang {tingkatan}.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {itemKategoriIni.map(i => {
                const nilai = progressMap[i.id] || 'belum';
                return (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{i.nama_item}</span>
                    <button
                      onClick={() => setPopupItem(i)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-extrabold ${NILAI_WARNA[nilai]}`}
                    >
                      {nilai === 'belum' ? 'Belum' : nilai}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Popup pilih nilai */}
      {popupItem && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/40 backdrop-blur-[2px]" onClick={() => setPopupItem(null)}>
          <div className="w-full rounded-t-[2rem] bg-surface p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <p className="mb-4 text-sm font-bold text-ink">{popupItem.nama_item}</p>
            <div className="space-y-2">
              {NILAI_LIST.map(n => {
                const aktif = (progressMap[popupItem.id] || 'belum') === n;
                return (
                  <button
                    key={n}
                    onClick={() => pilihNilai(popupItem.id, n)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                      aktif ? 'bg-ink' : 'bg-secondary active:opacity-70'
                    }`}
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${NILAI_WARNA[n]}`}>
                      {n === 'belum' ? <span className={`size-2.5 rounded-full ${NILAI_DOT[n]}`} /> : n}
                    </span>
                    <span className={`min-w-0 flex-1 text-sm font-bold ${aktif ? 'text-primary-foreground' : 'text-ink'}`}>
                      {NILAI_LABEL[n]}
                    </span>
                    {aktif && <Check className="size-4 shrink-0 text-primary-foreground" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AppScreen>
  );
}
