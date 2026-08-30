'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { TingkatanIcon, getTingkatan } from '@/components/tingkatan';
import { ChevronLeft, ArrowLeft, Target, Users, ClipboardList, ListChecks } from 'lucide-react';

function getPersenColor(persen) {
  if (persen === null) return '#9ca3af';
  if (persen >= 80) return '#16a34a';
  if (persen >= 60) return '#ca8a04';
  return '#dc2626';
}

export default function RekapTargetPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  const { data: kelompok, isLoading: loading } = useSWR(
    session && kelompokId ? `/api/kelompok/${kelompokId}` : null,
    { onError: () => router.replace('/dashboard') }
  );

  const { data: rekap, isLoading: loadingRekap } = useSWR(
    kelompok ? `/api/rekap-target?kelompok_id=${kelompokId}` : null,
    { keepPreviousData: true }
  );

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  if (loading || !kelompok) return (
    <AppScreen>
      <div className="space-y-4 px-5 pt-8">
        <div className="h-10 w-48 animate-pulse rounded-2xl bg-muted" />
        <div className="h-28 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        <div className="h-20 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
      </div>
    </AppScreen>
  );

  const tk = getTingkatan(kelompok?.tingkatan);

  return (
    <AppScreen>
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 pt-6">
        <button
          onClick={() => router.push('/dashboard')}
          aria-label="Kembali"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
        >
          <ChevronLeft className="size-5 text-ink" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-ink">{kelompok?.nama_kelompok}</h1>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <TingkatanIcon tingkatan={kelompok?.tingkatan} className="size-3.5 shrink-0" />
            {tk.label} · {kelompok?.desa}
          </p>
        </div>
      </header>

      {loadingRekap ? (
        <div className="space-y-3 px-5 pt-5">
          <div className="h-20 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
          <div className="h-40 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        </div>
      ) : rekap ? (
        <>
          {/* Ringkasan capaian keseluruhan */}
          <section className="px-5 pt-5">
            <div className="rounded-3xl brand-gradient p-4 shadow-[var(--shadow-float)]">
              <h2 className="flex items-center gap-2 text-sm font-bold text-primary-foreground/90">
                <Target className="size-4" /> Capaian Target Kelompok
              </h2>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-3xl font-extrabold text-primary-foreground">{rekap.persen_global}%</span>
                <span className="text-xs font-semibold text-primary-foreground/85">
                  {rekap.total_item} target per murid
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${rekap.persen_global}%` }} />
              </div>
            </div>
          </section>

          {/* Ringkasan per kategori */}
          {rekap.per_kategori?.length > 0 && (
            <section className="px-5 pt-4">
              <div className="card-soft p-4">
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
                  <ListChecks className="size-4 text-primary" /> Ringkasan per Kategori
                </h2>
                <div className="mt-3 space-y-3">
                  {rekap.per_kategori.map(k => {
                    const persen = k.total > 0 ? Math.round((k.tercapai / k.total) * 100) : 0;
                    return (
                      <div key={k.key}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink">{k.label}</span>
                          <span className="font-extrabold" style={{ color: getPersenColor(persen) }}>
                            {k.total > 0 ? `${persen}%` : '–'}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${persen}%`, background: getPersenColor(persen) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Rekap per murid */}
          {rekap.rekap_murid?.length === 0 ? (
            <div className="card-soft mx-5 mt-4 p-6 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-primary">
                <ClipboardList className="size-7" />
              </div>
              <h3 className="mt-3 text-base font-extrabold text-ink">Belum ada murid</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tambahkan murid dulu supaya rekap target bisa muncul.</p>
            </div>
          ) : (
            <section className="px-5 pt-4">
              <p className="mb-3 text-xs font-semibold text-muted-foreground">
                Detail Per Murid — diurutkan dari capaian tertinggi
              </p>
              <div className="space-y-3">
                {[...rekap.rekap_murid]
                  .sort((a, b) => (b.persen ?? -1) - (a.persen ?? -1))
                  .map((m, i) => (
                  <button
                    key={m.murid_id}
                    onClick={() => router.push(`/target/${kelompokId}/murid/${m.murid_id}`)}
                    className="card-soft block w-full p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                        i < 3 ? 'bg-amber-400 text-ink' : 'bg-brand-soft text-primary'
                      }`}>{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{m.nama}</span>
                      <span className="shrink-0 text-lg font-extrabold" style={{ color: getPersenColor(m.persen) }}>
                        {m.persen === null ? '–' : `${m.persen}%`}
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        width: `${m.persen ?? 0}%`,
                        background: m.persen >= 80 ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                          : m.persen >= 60 ? 'linear-gradient(90deg,#ca8a04,#eab308)'
                          : 'linear-gradient(90deg,#dc2626,#ef4444)',
                      }} />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">
                      Tercapai {m.tercapai} dari {m.total} target
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}

      <div className="h-44" />

      <div className="pointer-events-none fixed bottom-[5.75rem] left-1/2 z-40 w-full max-w-[26rem] -translate-x-1/2 px-5">
        <div className="pointer-events-auto flex gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 rounded-full bg-surface px-5 py-3.5 text-sm font-bold text-ink shadow-[var(--shadow-card)]"
          >
            <ArrowLeft className="size-4" /> Dashboard
          </button>
          <button
            onClick={() => router.push(`/target/${kelompokId}`)}
            className="flex-1 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]"
          >
            <Users className="mr-1 inline size-4" /> Isi Target Murid
          </button>
        </div>
      </div>
    </AppScreen>
  );
}
