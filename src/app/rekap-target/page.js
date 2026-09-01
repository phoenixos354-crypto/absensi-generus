'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { BackButton } from '@/components/BackButton';
import { TingkatanIcon, TINGKATAN_LABEL } from '@/components/tingkatan';
import {
  Users, Trophy, Percent, Layers, CheckCircle2,
  Target, MapPin, ChevronRight, ClipboardList,
} from 'lucide-react';

function getPersenWarna(persen) {
  if (persen === null) return { bar: '#e5e7eb', text: '#9ca3af', chip: '#f3f4f6' };
  if (persen >= 80) return { bar: '#22c55e', text: '#16a34a', chip: '#dcfce7' };
  if (persen >= 60) return { bar: '#eab308', text: '#ca8a04', chip: '#fef9c3' };
  return { bar: '#f97316', text: '#ea580c', chip: '#ffedd5' };
}

export default function RekapTargetGlobalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  const [tabTingkatan, setTabTingkatan] = useState('caberawit');

  const { data: kelompokAkses } = useSWR(session ? '/api/kelompok' : null);
  const { data: rekap, isLoading } = useSWR(
    session ? `/api/rekap-target-global?tingkatan=${tabTingkatan}` : null,
    { keepPreviousData: true }
  );

  const tabTersedia = useMemo(() => {
    const counts = rekap?.tingkatan_counts || {};
    return Object.entries(TINGKATAN_LABEL)
      .filter(([key]) => counts[key] > 0)
      .map(([key, val]) => ({ key, label: val.label, count: counts[key] }));
  }, [rekap]);

  useEffect(() => {
    if (tabTersedia.length === 0) return;
    const tersedia = tabTersedia.some(t => t.key === tabTingkatan);
    if (!tersedia) setTabTingkatan(tabTersedia[0].key);
  }, [tabTersedia, tabTingkatan]);

  const infoWilayah = useMemo(() => {
    const list = rekap?.kelompok_list || [];
    if (list.length === 0) return null;
    const daerahSet = new Set(list.map(k => k.daerah).filter(Boolean));
    const desaSet = new Set(list.map(k => k.desa).filter(Boolean));
    if (daerahSet.size === 1) {
      return desaSet.size === 1
        ? `${[...desaSet][0]} · ${[...daerahSet][0]}`
        : [...daerahSet][0];
    }
    return `${list.length} Kelompok`;
  }, [rekap]);

  const belumAdaKelompok = kelompokAkses && Array.isArray(kelompokAkses) && kelompokAkses.length === 0;

  return (
    <AppScreen>
      <header className="relative overflow-hidden px-5 pb-8 pt-6" style={{ background: 'linear-gradient(160deg,#155dfc 0%,#1447c9 100%)' }}>
        <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <BackButton
            fallbackHref="/dashboard"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-white"
            iconClassName="size-5"
          />
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Rekap Target
            </span>
          </div>
          <div className="size-10" />
        </div>

        <div className="relative z-10 mt-4 text-center text-white">
          <h1 className="text-2xl font-extrabold leading-tight">Rekap Target &amp; Capaian</h1>
          {infoWilayah && <p className="mt-1.5 text-sm text-white/80">{infoWilayah}</p>}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-white/80">
            <span className="flex items-center gap-1"><Layers className="size-3.5" /> {tabTersedia.length || 0} Tingkatan</span>
            <span className="flex items-center gap-1"><Users className="size-3.5" /> {rekap?.stats?.total_murid ?? 0} murid</span>
          </div>
        </div>
      </header>

      {belumAdaKelompok ? (
        <div className="card-soft mx-5 mt-5 p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-primary">
            <ClipboardList className="size-7" />
          </div>
          <h3 className="mt-3 text-base font-extrabold text-ink">Belum ada kelompok</h3>
          <p className="mt-1 text-sm text-muted-foreground">Buat atau minta akses ke kelompok dulu supaya rekap target bisa muncul di sini.</p>
        </div>
      ) : (
        <>
          {tabTersedia.length > 0 && (
            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
              {tabTersedia.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTabTingkatan(t.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                    tabTingkatan === t.key
                      ? 'bg-ink text-primary-foreground'
                      : 'bg-surface text-muted-foreground shadow-[var(--shadow-card)]'
                  }`}
                >
                  <TingkatanIcon tingkatan={t.key} className="size-3.5" />
                  <span>{t.label}</span>
                  <span className={`rounded-full px-1.5 text-[11px] font-bold ${tabTingkatan === t.key ? 'bg-white/25' : 'bg-border'}`}>{t.count}</span>
                </button>
              ))}
            </div>
          )}

          {isLoading && !rekap ? (
            <div className="space-y-4 px-5 pt-5">
              <div className="h-24 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
              <div className="h-40 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
              <div className="h-40 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
            </div>
          ) : rekap ? (
            <>
              <section className="px-5 pt-5">
                <div className="grid grid-cols-3 gap-2.5">
                  <StatCard icon={Users} iconBg="#dbeafe" iconColor="#2563eb" value={rekap.stats.total_murid} label="Total Murid" />
                  <StatCard icon={Trophy} iconBg="#dcfce7" iconColor="#16a34a" value={rekap.stats.tercapai_100} label="Target 100%" />
                  <StatCard icon={Percent} iconBg="#ffedd5" iconColor="#ea580c" value={`${rekap.stats.avg_persen}%`} label="Rata-rata Capaian" />
                  <StatCard icon={Layers} iconBg="#f3e8ff" iconColor="#9333ea" value={rekap.stats.kelompok_aktif} label="Kelompok Aktif" />
                  <StatCard icon={CheckCircle2} iconBg="#dbeafe" iconColor="#2563eb" value={rekap.stats.total_tercapai} label="Total Tercapai" />
                </div>
              </section>

              {rekap.kelompok_list.length > 0 && (
                <section className="px-5 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-ink">Perbandingan Kelompok</h2>
                    <span className="text-[11px] font-semibold text-muted-foreground">% Capaian Target</span>
                  </div>
                  <div className="card-soft space-y-3.5 p-4">
                    {rekap.kelompok_list.map(k => {
                      const w = getPersenWarna(k.persen);
                      return (
                        <button
                          key={k.id}
                          onClick={() => router.push(`/rekap-target/${k.id}`)}
                          className="block w-full text-left"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-bold text-ink">{k.nama_kelompok}</span>
                            <span className="shrink-0 font-extrabold" style={{ color: w.text }}>
                              {k.persen === null ? '–' : `${k.persen}%`}
                            </span>
                          </div>
                          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-border">
                            <div
                              className="flex h-full items-center rounded-full px-2 text-[10px] font-bold text-white transition-all duration-500"
                              style={{ width: `${Math.max(k.persen ?? 0, k.persen ? 10 : 0)}%`, background: w.bar }}
                            >
                              {k.persen !== null && k.persen >= 15 ? `${k.persen}%` : ''}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {rekap.top_murid.length > 0 && (
                <section className="px-5 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-ink">Murid Terdepan</h2>
                    <span className="text-[11px] font-semibold text-muted-foreground">Target 100%</span>
                  </div>
                  <div className="space-y-2">
                    {rekap.top_murid.map((m, i) => (
                      <div key={m.murid_id} className="card-soft flex items-center gap-3 p-3.5">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                          i < 3 ? 'bg-amber-400 text-ink' : 'bg-brand-soft text-primary'
                        }`}>
                          {i < 3 ? <Trophy className="size-4" /> : i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">{m.nama}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0" /> {m.nama_kelompok}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold text-primary">100%</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {rekap.kelompok_list.length > 0 && (
                <section className="px-5 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-ink">Detail per Kelompok</h2>
                    <span className="text-[11px] font-semibold text-muted-foreground">Tap untuk lihat rekap</span>
                  </div>
                  <div className="space-y-3">
                    {rekap.kelompok_list.map(k => {
                      const w = getPersenWarna(k.persen);
                      return (
                        <button
                          key={k.id}
                          onClick={() => router.push(`/rekap-target/${k.id}`)}
                          className="card-soft flex w-full items-center gap-3 p-4 text-left transition-transform active:scale-[0.99]"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                            <TingkatanIcon tingkatan={k.tingkatan} className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-ink">{k.nama_kelompok}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {k.total_murid} murid · {k.total_item} target/murid
                            </p>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${k.persen ?? 0}%`, background: w.bar }} />
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ background: w.chip, color: w.text }}>
                              {k.persen === null ? 'Belum ada data' : `${k.persen}%`}
                            </span>
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          ) : null}
        </>
      )}

      <div className="h-8" />
    </AppScreen>
  );
}

function StatCard({ icon: Icon, iconBg, iconColor, value, label }) {
  return (
    <div className="card-soft min-w-0 p-3">
      <span className="grid size-7 place-items-center rounded-full" style={{ background: iconBg, color: iconColor }}>
        <Icon className="size-3.5" />
      </span>
      <p className="mt-1.5 truncate text-lg font-extrabold text-ink">{value}</p>
      <p className="truncate text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
