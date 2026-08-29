'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { NILAI_WARNA } from '@/lib/target-constants';
import { BookOpen, CalendarCheck, NotebookPen, MapPin, Map, ChevronLeft, ChevronRight } from 'lucide-react';

const fetcher = (url) => fetch(url).then(r => r.json());

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

export default function KartuPublikPage() {
  const params = useParams();
  const kode = params.kode;
  const [bulanDipilih, setBulanDipilih] = useState(bulanIniStr());
  const { data, error, isLoading } = useSWR(kode ? `/api/publik/${kode}?bulan=${bulanDipilih}` : null, fetcher, { keepPreviousData: true });

  if (isLoading) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <p className="text-lg font-extrabold text-ink">Kartu tidak ditemukan</p>
        <p className="text-sm text-muted-foreground">Cek kembali link yang dibagikan ya.</p>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-dvh bg-background pb-10">
      <section className="px-5 pt-8">
        <div className="rounded-3xl brand-gradient p-5 shadow-[var(--shadow-float)]">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-foreground/75">Kartu Perkembangan Ngaji</p>
          <h1 className="mt-1 text-2xl font-extrabold text-primary-foreground">{data.nama_murid}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">{data.nama_kelompok}</span>
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
              <MapPin className="size-3" /> {data.desa}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
              <Map className="size-3.5" /> {data.daerah}
            </span>
          </div>
        </div>
      </section>

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
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          {data.total_sesi_bulan === 0 ? (
            <p className="mt-3 text-center text-sm text-muted-foreground">Belum ada data absensi di bulan ini.</p>
          ) : (
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                <CalendarCheck className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-ink">{data.persen_hadir_bulan}%</p>
                <p className="text-xs text-muted-foreground">{data.total_hadir_bulan} dari {data.total_sesi_bulan} sesi</p>
              </div>
            </div>
          )}

          {data.total_sesi > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-[11px] font-semibold text-muted-foreground">Total keseluruhan (sejak awal)</span>
              <span className="text-xs font-extrabold text-ink">
                {data.total_hadir} dari {data.total_sesi} sesi &middot; {data.persen_hadir}%
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="px-5 pt-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <BookOpen className="size-4 text-primary" /> Capaian Target
        </h2>
        <div className="mt-2 space-y-2.5">
          {(data.target || []).map(kat => (
            <div key={kat.key} className="card-soft p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-ink">{kat.label}</p>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                  {kat.tercapai}/{kat.total}
                </span>
              </div>
              {kat.items.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Belum ada daftar target.</p>
              ) : (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {kat.items.map((it, idx) => (
                    <li key={idx} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${NILAI_WARNA[it.nilai]}`}>
                      {it.nama_item}{it.nilai !== 'belum' ? ` · ${it.nilai}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {data.jurnal?.length > 0 && (
        <section className="px-5 pt-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <NotebookPen className="size-4 text-primary" /> Jurnal Pengajian yang Dihadiri
          </h2>
          <div className="mt-2 space-y-2">
            {data.jurnal.map(j => (
              <div key={j.tanggal} className="card-soft p-3.5">
                <p className="text-xs font-bold text-muted-foreground">
                  {new Date(j.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-ink">{j.jurnal}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
