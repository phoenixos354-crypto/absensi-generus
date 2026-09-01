'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { BackButton } from '@/components/BackButton';
import { TingkatanIcon, getTingkatan } from '@/components/tingkatan';
import { Users, CalendarDays, MapPin, Map, Target } from 'lucide-react';

export default function KelompokDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  // SWR: cache tampil instan lalu revalidate background
  const { data: kelompok, isLoading: loading } = useSWR(
    session && kelompokId ? `/api/kelompok/${kelompokId}` : null,
    { onError: () => router.replace('/dashboard') }
  );

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  if (loading || !kelompok) return (
    <AppScreen>
      <div className="space-y-4 px-5 pt-8">
        <div className="h-10 w-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-32 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        <div className="h-40 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
      </div>
    </AppScreen>
  );

  const tk = getTingkatan(kelompok?.tingkatan);

  return (
    <AppScreen>
      {/* Header */}
      <header className="px-5 pt-6">
        <BackButton
          fallbackHref="/dashboard"
          className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
        />
      </header>

      <section className="px-5 pt-4">
        <div className="rounded-3xl brand-gradient p-4 shadow-[var(--shadow-float)]">
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-primary-foreground">
            <TingkatanIcon tingkatan={kelompok.tingkatan} className="size-5" /> {kelompok.nama_kelompok}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
              {tk.label}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
              <MapPin className="size-3" /> {kelompok.desa}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
              <Map className="size-3.5" /> {kelompok.daerah}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => router.push(`/absensi/${kelompokId}`)} className="rounded-full bg-white px-4 py-2.5 text-xs font-bold text-ink">
              Absensi
            </button>
            <button onClick={() => router.push(`/rekap/${kelompokId}`)} className="rounded-full bg-white/20 px-4 py-2.5 text-xs font-bold text-primary-foreground">
              Rekap
            </button>
            <button onClick={() => router.push(`/target/${kelompokId}`)} className="rounded-full bg-white/20 px-4 py-2.5 text-xs font-bold text-primary-foreground">
              <span className="flex items-center gap-1"><Target className="size-3.5" /> Target</span>
            </button>
            <button onClick={() => router.push(`/setup/${kelompokId}`)} className="rounded-full bg-white/20 px-4 py-2.5 text-xs font-bold text-primary-foreground">
              Kelola
            </button>
          </div>
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <Users className="size-4 text-primary" /> Murid ({kelompok.murid?.length || 0})
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {(kelompok.murid || []).map((m,i) => (
              <li key={m.id} className="flex items-center gap-2.5 py-2.5 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-extrabold text-primary">{i+1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{m.nama_murid}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-5 pb-6 pt-4">
        <div className="card-soft p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <CalendarDays className="size-4 text-primary" /> Jadwal Ngaji
          </h2>
          {(kelompok.jadwal || []).length === 0 ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Belum ada jadwal.
              <button onClick={() => router.push(`/setup/${kelompokId}`)} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-ink">
                Set Jadwal
              </button>
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {(kelompok.jadwal || []).map(j => (
                <span key={j.id} className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3.5 py-2 text-xs font-bold text-primary">
                  <CalendarDays className="size-3.5" /> {j.hari}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>
    </AppScreen>
  );
}
