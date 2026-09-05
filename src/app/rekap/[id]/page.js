'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { BackButton } from '@/components/BackButton';
import { TingkatanIcon, getTingkatan } from '@/components/tingkatan';
import { ArrowLeft, Calendar, CalendarRange, CalendarDays, Users, ClipboardList, CheckCircle2, NotebookPen, Wallet, Plus, Trash2, TrendingDown, TrendingUp, MinusCircle } from 'lucide-react';
import { ExportPDF } from '@/components/ExportPDF';
import * as Dialog from '@radix-ui/react-dialog';

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
    { onError: (err) => { if ([401, 403, 404].includes(err?.status)) router.replace('/dashboard'); } }
  );

  const [mode, setMode] = useState('bulan');
  const [nilai, setNilai] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });

  const { data: rekap, isLoading: loadingRekap, mutate: mutateRekap } = useSWR(
    kelompok ? `/api/rekap?kelompok_id=${kelompokId}&mode=${mode}&nilai=${nilai}` : null,
    { keepPreviousData: true }
  );

  // State modal pengeluaran infaq
  const [showModal, setShowModal] = useState(false);
  const [formTanggal, setFormTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formJumlah, setFormJumlah] = useState('');
  const [savingPengeluaran, setSavingPengeluaran] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // State urut murid di rekap: 'persen' atau 'abjad'
  const [sortMurid, setSortMurid] = useState('persen');

  function openModal() {
    setFormTanggal(new Date().toISOString().split('T')[0]);
    setFormKeterangan('');
    setFormJumlah('');
    setShowModal(true);
  }

  async function handleSavePengeluaran() {
    if (!formKeterangan.trim() || !formJumlah || Number(formJumlah) <= 0) return;
    setSavingPengeluaran(true);
    try {
      const res = await fetch('/api/pengeluaran-infaq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelompok_id: kelompokId,
          tanggal: formTanggal,
          keterangan: formKeterangan.trim(),
          jumlah: Number(formJumlah),
        }),
      });
      if (res.ok) {
        setShowModal(false);
        await mutateRekap();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menyimpan pengeluaran');
      }
    } catch {
      alert('Gagal menyimpan pengeluaran');
    }
    setSavingPengeluaran(false);
  }

  async function handleDeletePengeluaran(id) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/pengeluaran-infaq?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await mutateRekap();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus pengeluaran');
      }
    } catch {
      alert('Gagal menghapus pengeluaran');
    }
    setDeletingId(null);
  }

  function formatRupiah(n) {
    return Number(n || 0).toLocaleString('id-ID');
  }

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
        <BackButton
          fallbackHref="/dashboard"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
        />
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
            <div className="grid grid-cols-3 gap-3">
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
              <div className="card-soft p-4">
                <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-primary">
                  <Wallet className="size-4" />
                </span>
                <p className="mt-2 truncate text-2xl font-extrabold text-ink">
                  {(rekap.total_infaq || 0) >= 1000 ? `${Math.round((rekap.total_infaq || 0)/1000)}rb` : (rekap.total_infaq || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Infaq</p>
              </div>
            </div>
          </section>

          {/* Card detail infaq: masuk, keluar, sisa + tombol catat pengeluaran */}
          <section className="px-5 pt-4">
            <div className="card-soft p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-ink">Ringkasan Infaq</h2>
                <button
                  onClick={openModal}
                  className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-primary transition-colors active:scale-95"
                >
                  <Plus className="size-3.5" />
                  Catat Pengeluaran
                </button>
              </div>

              <div className="mt-3 space-y-2.5">
                {/* Masuk */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <TrendingUp className="size-4 text-green-600" />
                    Infaq Masuk
                  </span>
                  <span className="text-sm font-extrabold text-green-600">
                    Rp{formatRupiah(rekap.total_infaq)}
                  </span>
                </div>
                {/* Keluar */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <TrendingDown className="size-4 text-red-600" />
                    Pengeluaran
                  </span>
                  <span className="text-sm font-extrabold text-red-600">
                    Rp{formatRupiah(rekap.total_pengeluaran)}
                  </span>
                </div>
                {/* Divider */}
                <div className="border-t border-border" />
                {/* Sisa */}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-ink">
                    <Wallet className="size-4 text-primary" />
                    Sisa Infaq
                  </span>
                  <span className={`text-base font-extrabold ${(rekap.sisa_infaq || 0) < 0 ? 'text-red-600' : 'text-primary'}`}>
                    Rp{formatRupiah(rekap.sisa_infaq)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Rincian pengeluaran infaq */}
          {rekap.daftar_pengeluaran?.length > 0 && (
            <section className="px-5 pt-4">
              <div className="card-soft p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-red-50 text-red-600">
                      <MinusCircle className="size-4" />
                    </span>
                    <h2 className="text-sm font-extrabold text-ink">Rincian Pengeluaran</h2>
                  </span>
                  <span className="text-sm font-extrabold text-red-600">
                    Rp{formatRupiah(rekap.total_pengeluaran)}
                  </span>
                </div>

                <div className="mt-3.5 space-y-2.5">
                  {rekap.daftar_pengeluaran.map(p => (
                    <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-secondary p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{p.keterangan || '(tanpa keterangan)'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.tanggal).toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-extrabold text-red-600">
                        -Rp{formatRupiah(p.jumlah)}
                      </span>
                      <button
                        onClick={() => handleDeletePengeluaran(p.id)}
                        disabled={deletingId === p.id}
                        className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 active:scale-90 disabled:opacity-40"
                        title="Hapus pengeluaran"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

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

          {/* Jurnal & Infaq per sesi */}
          {rekap.daftar_sesi?.length > 0 && (
            <section className="px-5 pt-4">
              <div className="card-soft p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-primary">
                      <NotebookPen className="size-4" />
                    </span>
                    <h2 className="text-sm font-extrabold text-ink">Jurnal &amp; Infaq</h2>
                  </span>
                  {rekap.total_infaq > 0 && (
                    <span className="text-sm font-extrabold text-primary">
                      Rp{rekap.total_infaq.toLocaleString('id-ID')}
                    </span>
                  )}
                </div>

                <div className="mt-3.5 space-y-3">
                  {rekap.daftar_sesi.map(s => (
                    <div key={s.tanggal} className="rounded-2xl bg-secondary p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          {new Date(s.tanggal).toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
                        </span>
                        {s.infaq > 0 && (
                          <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-primary">
                            Rp{s.infaq.toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                      {s.jurnal && (
                        <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink">{s.jurnal}</p>
                      )}
                    </div>
                  ))}
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
              <h3 className="mt-3 text-base font-extrabold text-ink">Belum ada data absensi</h3>
              <p className="mt-1 text-sm text-muted-foreground">Untuk periode ini belum ada absensi yang dicatat.</p>
              <button onClick={() => router.push(`/absensi/${kelompokId}`)} className="mt-4 w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]">
                Catat Absensi Sekarang
              </button>
            </div>
          ) : (
            <section className="px-5 pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Detail Per Murid
                </p>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setSortMurid('persen')}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                      sortMurid === 'persen'
                        ? 'bg-ink text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    % Hadir
                  </button>
                  <button
                    onClick={() => setSortMurid('abjad')}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                      sortMurid === 'abjad'
                        ? 'bg-ink text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    Abjad
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {[...rekap.rekap_murid]
                  .sort((a,b) => sortMurid === 'abjad'
                    ? a.nama.localeCompare(b.nama, 'id')
                    : b.persen_hadir - a.persen_hadir
                  )
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

      {/* Modal: Catat Pengeluaran Infaq */}
      <Dialog.Root open={showModal} onOpenChange={setShowModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface p-6 shadow-2xl">
            <Dialog.Title className="text-lg font-extrabold text-ink">
              Catat Pengeluaran Infaq
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              Tambahkan pengeluaran infaq untuk kelompok ini.
            </Dialog.Description>

            <div className="mt-5 space-y-4">
              {/* Tanggal */}
              <div>
                <label className="text-xs font-bold text-muted-foreground">Tanggal</label>
                <input
                  type="date"
                  value={formTanggal}
                  onChange={e => setFormTanggal(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Keterangan */}
              <div>
                <label className="text-xs font-bold text-muted-foreground">Keterangan</label>
                <input
                  type="text"
                  value={formKeterangan}
                  onChange={e => setFormKeterangan(e.target.value)}
                  placeholder="Misal: Beli buku Iqra, Snack murid"
                  className="mt-1.5 w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Jumlah */}
              <div>
                <label className="text-xs font-bold text-muted-foreground">Jumlah Pengeluaran</label>
                <div className="mt-1.5 flex items-center rounded-2xl bg-secondary px-4 py-3 focus-within:ring-2 focus-within:ring-primary/40">
                  <span className="mr-1 text-sm font-bold text-muted-foreground">Rp</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formJumlah}
                    onChange={e => setFormJumlah(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>
                {formJumlah && Number(formJumlah) > 0 && (
                  <p className="mt-1.5 text-xs font-bold text-primary">
                    = Rp{formatRupiah(Number(formJumlah))}
                  </p>
                )}
              </div>
            </div>

            {/* Tombol aksi */}
            <div className="mt-6 flex gap-3">
              <Dialog.Close asChild>
                <button
                  className="flex-1 rounded-full bg-secondary py-3.5 text-sm font-bold text-muted-foreground transition-colors active:scale-[0.99]"
                >
                  Batal
                </button>
              </Dialog.Close>
              <button
                onClick={handleSavePengeluaran}
                disabled={savingPengeluaran || !formKeterangan.trim() || !formJumlah || Number(formJumlah) <= 0}
                className="flex-1 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] transition-transform active:scale-[0.99] disabled:opacity-50"
              >
                {savingPengeluaran ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppScreen>
  );
}
