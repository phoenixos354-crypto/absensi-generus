'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { TingkatanIcon, getTingkatan } from '@/components/tingkatan';
import { ChevronLeft, ChevronRight, Target, Settings2, Users } from 'lucide-react';

export default function TargetListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;
  const [popupBukanOwner, setPopupBukanOwner] = useState(false);

  const { data: kelompok, isLoading } = useSWR(
    session && kelompokId ? `/api/kelompok/${kelompokId}` : null,
    { onError: () => router.replace('/dashboard') }
  );

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (kelompok && kelompok.permission !== 'owner') setPopupBukanOwner(true);
  }, [kelompok]);

  if (isLoading || !kelompok) {
    return (
      <AppScreen>
        <div className="space-y-4 px-5 pt-8">
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-40 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        </div>
      </AppScreen>
    );
  }

  const tk = getTingkatan(kelompok.tingkatan);
  const bisaKelola = kelompok.permission === 'owner';

  return (
    <AppScreen>
      <header className="flex items-center justify-between px-5 pt-6">
        <button
          onClick={() => router.push(`/kelompok/${kelompokId}`)}
          aria-label="Kembali"
          className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
        >
          <ChevronLeft className="size-5 text-ink" />
        </button>
        {bisaKelola && (
          <button
            onClick={() => router.push(`/target/${kelompokId}/pengaturan`)}
            className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-xs font-bold text-ink shadow-[var(--shadow-card)]"
          >
            <Settings2 className="size-4" /> Kelola Target
          </button>
        )}
      </header>

      <section className="px-5 pt-4">
        <div className="rounded-3xl brand-gradient p-4 shadow-[var(--shadow-float)]">
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-primary-foreground">
            <Target className="size-5" /> Target &amp; Capaian
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-primary-foreground/85">
            <TingkatanIcon tingkatan={kelompok.tingkatan} className="size-3.5" /> {kelompok.nama_kelompok} &middot; {tk.label}
          </p>
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <Users className="size-4 text-primary" /> Pilih Murid
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {(kelompok.murid || []).length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Belum ada murid di kelompok ini.</p>
            )}
            {(kelompok.murid || []).map((m, i) => (
              <li key={m.id}>
                <button
                  onClick={() => router.push(`/target/${kelompokId}/murid/${m.id}`)}
                  className="flex w-full items-center gap-3 py-3 text-left active:opacity-70"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-extrabold text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.nama_murid}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {popupBukanOwner && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-6" onClick={() => setPopupBukanOwner(false)}>
          <div className="w-full max-w-xs rounded-3xl bg-surface p-5 text-center shadow-[var(--shadow-float)]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-primary">
              <Users className="size-6" />
            </div>
            <h3 className="mt-3 text-base font-extrabold text-ink">Anda Bukan Pemilik Kelompok Ini</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Kamu tetap bisa melihat data target &amp; capaian, tapi hanya owner kelompok yang bisa mengelola target.
            </p>
            <button
              onClick={() => setPopupBukanOwner(false)}
              className="mt-4 w-full rounded-full bg-ink py-3 text-sm font-bold text-primary-foreground"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </AppScreen>
  );
}
