'use client';
import useSWR from 'swr';

const TIPE_LABEL = { quran: "Al-Qur'an", hadis: 'Hadis' };

// Mascot burung: taruh 5 file di /public/mascots/ dengan nama persis
// mascot-1.webp ... mascot-5.webp (background transparan, format webp).
// Mascot yang tampil berganti tiap hari mengikuti mascot_index dari API
// (bukan diacak tiap render, supaya konsisten sepanjang hari yang sama).
export function DalilWidget() {
  const { data, isLoading } = useSWR('/api/dalil-hari-ini');

  const mascotSrc = `/mascots/mascot-${data?.mascot_index || 1}.webp`;

  return (
    <div className="relative mx-5 mt-7 min-h-[8.5rem] overflow-hidden rounded-3xl card-soft p-5">
      <div className="relative z-10 max-w-[60%]">
        {isLoading || !data ? (
          <>
            <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
            <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-muted" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-muted" />
          </>
        ) : (
          <>
            <span className="inline-block rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              {TIPE_LABEL[data.tipe] || 'Dalil'} · Generasi Penerus
            </span>
            <p className="mt-2.5 line-clamp-4 text-sm font-semibold leading-snug text-ink">
              {data.teks_terjemah}
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">{data.sumber}</p>
          </>
        )}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mascotSrc}
        alt="Mascot"
        className="pointer-events-none absolute -bottom-3 -right-2 h-32 w-auto select-none"
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}
