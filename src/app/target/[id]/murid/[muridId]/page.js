'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { KATEGORI, URUTAN_TINGKATAN, NILAI_LIST, NILAI_WARNA } from '@/lib/target-constants';
import { ChevronLeft, Share2, ChevronDown, Check } from 'lucide-react';

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

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  const { data: kelompok } = useSWR(session && kelompokId ? `/api/kelompok/${kelompokId}` : null);
  const { data: itemData } = useSWR(session && kelompokId ? `/api/target-item?kelompok_id=${kelompokId}` : null);
  const { data: progress } = useSWR(session && muridId ? `/api/target-progress?murid_id=${muridId}` : null);

  const murid = kelompok?.murid?.find(m => m.id === muridId);
  const tingkatan = kelompok?.tingkatan;
  const items = itemData?.items || [];
  const progressMap = useMemo(() => {
    const m = {};
    (progress || []).forEach(p => { m[p.item_id] = p.nilai; });
    return m;
  }, [progress]);

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

  async function pilihNilai(itemId, nilai) {
    setPopupItem(null);
    await fetch('/api/target-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ murid_id: muridId, item_id: itemId, nilai }),
    });
    mutate(`/api/target-progress?murid_id=${muridId}`);
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
            <div className="grid grid-cols-5 gap-2">
              {NILAI_LIST.map(n => {
                const aktif = (progressMap[popupItem.id] || 'belum') === n;
                return (
                  <button
                    key={n}
                    onClick={() => pilihNilai(popupItem.id, n)}
                    className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-sm font-extrabold ${NILAI_WARNA[n]} ${aktif ? 'ring-2 ring-ink/20' : ''}`}
                  >
                    {aktif && <Check className="size-3.5" />}
                    {n === 'belum' ? 'Belum' : n}
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
