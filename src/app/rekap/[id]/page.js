'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { TingkatanIcon, getTingkatan } from '@/components/tingkatan';
import { ChevronLeft, ArrowLeft, Calendar, CalendarRange, CalendarDays, Users, ClipboardList, CheckCircle2 } from 'lucide-react';
import { ExportPDF } from '@/components/ExportPDF';

// Generate daftar bulan (12 bulan terakhir)
function getBulanList() {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('id-ID', { month:'long', year:'numeric' });
    result.push({ val, label });
  }
  return result;
}

// Generate daftar minggu (12 minggu terakhir)
function getMingguList() {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const week = getWeekNumber(d);
    const val = `${d.getFullYear()}-${String(week).padStart(2,'0')}`;
    const mulai = new Date(d);
    mulai.setDate(mulai.getDate() - mulai.getDay() + 1);
    const akhir = new Date(mulai);
    akhir.setDate(akhir.getDate() + 6);
    const label = `${mulai.toLocaleDateString('id-ID',{day:'numeric',month:'short'})} – ${akhir.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}`;
    result.push({ val, label });
  }
  return [...new Map(result.map(r => [r.val, r])).values()];
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

export default function RekapPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  // SWR: kelompok + rekap, cache tampil instan lalu revalidate background
  const { data: kelompok, isLoading: loading } = useSWR(
    session && kelompokId ? `/api/kelompok/${kelompokId}` : null,
    { onError: () => router.replace('/dashboard') }
  );

  const [mode, setMode] = useState('bulan');
  const [nilai, setNilai] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });

  const { data: rekap, isLoading: loadingRekap } = useSWR(
    kelompok ? `/api/rekap?kelompok_id=${kelompokId}&mode=${mode}&nilai=${nilai}` : null,
    { keepPreviousData: true }
  );

  const bulanList  = getBulanList();
  const mingguList = getMingguList();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  function handleModeChange(m) {
    setMode(m);
    if (m === 'bulan') {
      const now = new Date();
      setNilai(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
    } else if (m === 'minggu') {
      setNilai(mingguList[0]?.val || '');
    } else {
      setNilai(new Date().toISOString().split('T')[0]);
    }
  }

  function getPersenColor(persen) {
    if (persen >= 80) return '#16a34a';
    if (persen >= 60) return '#ca8a04';
    return '#dc2626';
  }

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
      {/* Header */}
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

      {/* Filter periode */}
      <section className="px-5 pt-5">
        <div className="card-soft p-4">
          <div className="flex gap-2">
            {['hari','minggu','bulan'].map(m => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  mode === m
                    ? 'bg-ink text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {m === 'hari' ? <Calendar className="mr-1 inline size-4" /> : m === 'minggu' ? <CalendarRange className="mr-1 inline size-4" /> : <CalendarDays className="mr-1 inline size-4" />}
                {m === 'hari' ? 'Hari' : m === 'minggu' ? 'Minggu' : 'Bulan'}
              </button>
            ))}
          </div>
          {mode === 'hari' && (
            <input type="date" value={nilai} onChange={e => setNilai(e.target.value)}
              className="mt-3 w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40" />
          )}
          {mode === 'minggu' && (
            <select value={nilai} onChange={e => setNilai(e.target.value)}
              className="mt-3 w-full appearance-none rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40">
              {mingguList.map(w => <option key={w.val} value={w.val}>{w.label}</option>)}
            </select>
          )}
          {mode === 'bulan' && (
            <select value={nilai} onChange={e => setNilai(e.target.value)}
              className="mt-3 w-full appearance-none rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40">
              {bulanList.map(b => <option key={b.val} value={b.val}>{b.label}</option>)}
            </select>
          )}
        </div>
      </section>

      {loadingRekap ? (
        <div className="space-y-3 px-5 pt-5">
          <div className="h-20 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
          <div className="h-20 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        </div>
      ) : rekap ? (
        <>
          {/* Stat ringkas */}
          <section className="px-5 pt-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="card-soft p-4">
                <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-primary">
                  <CalendarDays className="size-4" />
                </span>
                <p className="mt-2 text-2xl font-extrabold text-ink">{rekap.total_sesi}</p>
                <p className="text-xs text-muted-foreground">Sesi Ngaji</p>
              </div>
              <div className="card-soft p-4">
                <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-primary">
                  <Users className="size-4" />
                </span>
                <p className="mt-2 text-2xl font-extrabold text-ink">{rekap.rekap_murid?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Murid</p>
              </div>
            </div>
          </section>

          {/* Progress semua status */}
          {(() => {
            const totalHadir = rekap.rekap_murid?.reduce((s,m) => s+m.hadir, 0) || 0;
            const totalIzin  = rekap.rekap_murid?.reduce((s,m) => s+m.izin,  0) || 0;
            const totalSakit = rekap.rekap_murid?.reduce((s,m) => s+m.sakit, 0) || 0;
            const totalAlfa  = rekap.rekap_murid?.reduce((s,m) => s+m.alfa,  0) || 0;
            const totalAll   = totalHadir + totalIzin + totalSakit + totalAlfa;
            const pH = totalAll > 0 ? Math.round(totalHadir/totalAll*100) : 0;
            const pI = totalAll > 0 ? Math.round(totalIzin/totalAll*100)  : 0;
            const pS = totalAll > 0 ? Math.round(totalSakit/totalAll*100) : 0;
            const pA = totalAll > 0 ? Math.round(totalAlfa/totalAll*100)  : 0;
            const stats = [
              { label:'Hadir',  nilai:totalHadir, persen:pH, bg:'#dcfce7', color:'#166534', bar:'#22c55e' },
              { label:'Izin',   nilai:totalIzin,  persen:pI, bg:'#fef9c3', color:'#854d0e', bar:'#eab308' },
              { label:'Sakit',  nilai:totalSakit, persen:pS, bg:'#dbeafe', color:'#1e40af', bar:'#3b82f6' },
              { label:'Alfa',   nilai:totalAlfa,  persen:pA, bg:'#fee2e2', color:'#991b1b', bar:'#ef4444' },
            ];
            return (
              <section className="px-5 pt-4">
                <div className="card-soft p-4">
                  <h2 className="text-base font-bold text-ink">Rekapitulasi Global</h2>
                  <div className="mt-3 space-y-3">
                    {stats.map(s => (
                      <div key={s.label}>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background:s.bg, color:s.color }}>
                              {s.label}
                            </span>
                            <span className="text-xs text-muted-foreground">{s.nilai} kali</span>
                          </span>
                          <span className="text-sm font-extrabold" style={{ color:s.color }}>{s.persen}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width:`${s.persen}%`, background:s.bar }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {rekap.tanggal_sesi?.length > 0 && (
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                      Sesi: {rekap.tanggal_sesi.map(t => new Date(t).toLocaleDateString('id-ID',{day:'numeric',month:'short'})).join(' · ')}
                    </p>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Tombol Export PDF */}
          {rekap.rekap_murid?.length > 0 && (
            <div className="px-5 pt-4">
              <ExportPDF
                kelompok={kelompok}
                rekap={rekap}
                periode={
                  mode === 'hari' ? new Date(nilai).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})
                  : mode === 'minggu' ? `Minggu ${nilai}`
                  : new Date(nilai+'-01').toLocaleDateString('id-ID',{month:'long',year:'numeric'})
                }
              />
            </div>
          )}

          {/* Rekap per murid */}
          {rekap.rekap_murid?.length === 0 ? (
            <div className="card-soft mx-5 mt-4 p-6 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-primary">
                <ClipboardList className="size-7" />
              </div>
              <h3 className="mt-3 text-base font-extrabold text-ink">Belum ada data absensi</h3>
              <p className="mt-1 text-sm text-muted-foreground">Untuk periode ini belum ada absensi yang dicatat.</p>
              <button onClick={() => router.push(`/absensi/${kelompokId}`)} className="mt-4 w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]">
                Catat Absensi Sekarang
              </button>
            </div>
          ) : (
            <section className="px-5 pt-4">
              <p className="mb-3 text-xs font-semibold text-muted-foreground">
                Detail Per Murid — diurutkan dari kehadiran tertinggi
              </p>
              <div className="space-y-3">
                {[...rekap.rekap_murid]
                  .sort((a,b) => b.persen_hadir - a.persen_hadir)
                  .map((m, i) => (
                  <div key={m.murid_id} className="card-soft p-4">
                    <div className="flex items-center gap-3">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                        i < 3 ? 'bg-amber-400 text-ink' : 'bg-brand-soft text-primary'
                      }`}>{i+1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{m.nama}</span>
                      <span className="shrink-0 text-lg font-extrabold" style={{ color: getPersenColor(m.persen_hadir) }}>
                        {m.persen_hadir}%
                      </span>
                    </div>

                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        width:`${m.persen_hadir}%`,
                        background: m.persen_hadir >= 80
                          ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                          : m.persen_hadir >= 60
                          ? 'linear-gradient(90deg,#ca8a04,#eab308)'
                          : 'linear-gradient(90deg,#dc2626,#ef4444)',
                      }} />
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#dcfce7] px-2.5 py-1 text-[11px] font-bold text-[#166534]">Hadir: {m.hadir}</span>
                      <span className="rounded-full bg-[#fef9c3] px-2.5 py-1 text-[11px] font-bold text-[#854d0e]">Izin: {m.izin}</span>
                      <span className="rounded-full bg-[#dbeafe] px-2.5 py-1 text-[11px] font-bold text-[#1e40af]">Sakit: {m.sakit}</span>
                      <span className="rounded-full bg-[#fee2e2] px-2.5 py-1 text-[11px] font-bold text-[#991b1b]">Alfa: {m.alfa}</span>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-muted-foreground">Total: {m.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}

      {/* Spacer biar tidak tertutup tombol melayang */}
      <div className="h-44" />

      {/* Bar aksi melayang */}
      <div className="pointer-events-none fixed bottom-[5.75rem] left-1/2 z-40 w-full max-w-[26rem] -translate-x-1/2 px-5">
        <div className="pointer-events-auto flex gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 rounded-full bg-surface px-5 py-3.5 text-sm font-bold text-ink shadow-[var(--shadow-card)]"
          >
            <ArrowLeft className="size-4" /> Dashboard
          </button>
          <button
            onClick={() => router.push(`/absensi/${kelompokId}`)}
            className="flex-1 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]"
          >
            <CheckCircle2 className="mr-1 inline size-4" /> Absensi
          </button>
        </div>
      </div>
    </AppScreen>
  );
}
