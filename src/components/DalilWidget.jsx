'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { X } from 'lucide-react';

const TIPE_LABEL = { quran: "Al-Qur'an", hadis: 'Hadis' };
const BATAS_RINGKAS = 90; // di atas ini, terjemah dipotong dan tombol "baca selengkapnya" muncul

// Mascot burung: taruh 5 file di /public/mascots/ dengan nama persis
// mascot-1.webp ... mascot-5.webp (background transparan, format webp).
// Mascot yang tampil berganti tiap hari mengikuti mascot_index dari API
// (bukan diacak tiap render, supaya konsisten sepanjang hari yang sama).
export function DalilWidget() {
  const { data, isLoading } = useSWR('/api/dalil-hari-ini');
  const [bukaDetail, setBukaDetail] = useState(false);

  const mascotSrc = `/mascots/mascot-${data?.mascot_index || 1}.webp`;
  const terjemahPanjang = (data?.teks_terjemah?.length || 0) > BATAS_RINGKAS;

  return (
    <>
      <div className="relative mx-5 mt-7 min-h-[10.5rem] rounded-3xl bg-secondary p-5">
        <div className="relative z-10 max-w-[56%]">
          {isLoading || !data ? (
            <>
              <div className="h-4 w-24 animate-pulse rounded-full bg-surface/60" />
              <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-surface/60" />
              <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-surface/60" />
            </>
          ) : (
            <>
              {data.teks_arab && (
                <p
                  dir="rtl"
                  lang="ar"
                  className="text-right text-[1.05rem] font-bold leading-[2] text-primary"
                  style={{ fontFamily: "'Scheherazade New', 'Traditional Arabic', serif" }}
                >
                  {data.teks_arab}
                </p>
              )}
              <p className={`${data.teks_arab ? 'mt-2' : ''} text-sm font-semibold leading-snug text-ink ${terjemahPanjang ? 'line-clamp-3' : ''}`}>
                {data.teks_terjemah}
              </p>
              {terjemahPanjang && (
                <button
                  onClick={() => setBukaDetail(true)}
                  className="mt-1 text-xs font-bold text-muted-foreground"
                >
                  Baca selengkapnya
                </button>
              )}
              <p className="mt-2 text-xs font-medium text-muted-foreground">{data.sumber}</p>
            </>
          )}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mascotSrc}
          alt="Mascot"
          className="pointer-events-none absolute -bottom-6 -right-3 z-10 h-52 w-auto select-none"
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {bukaDetail && data && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]"
          onClick={() => setBukaDetail(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8 shadow-[var(--shadow-float)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-primary">
                {TIPE_LABEL[data.tipe] || 'Dalil'}
              </span>
              <button
                aria-label="Tutup"
                onClick={() => setBukaDetail(false)}
                className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {data.teks_arab && (
              <p
                dir="rtl"
                lang="ar"
                className="text-right text-xl font-bold leading-[2.2] text-ink"
                style={{ fontFamily: "'Scheherazade New', 'Traditional Arabic', serif" }}
              >
                {data.teks_arab}
              </p>
            )}
            <p className="mt-4 text-sm font-medium leading-relaxed text-ink">{data.teks_terjemah}</p>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">{data.sumber}</p>
          </div>
        </div>
      )}
    </>
  );
}
