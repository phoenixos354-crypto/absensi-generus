'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo, Suspense } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { TingkatanIcon, getTingkatan, TINGKATAN_LABEL } from '@/components/tingkatan';
import { CircleHelp, BarChart3, CheckCircle2, Settings, Users, Pencil, Trash2, LayoutGrid, Landmark, MapPin, Map, X, TriangleAlert, ChevronRight } from 'lucide-react';
import userAvatar from '@/assets/user-avatar.jpg';

const FORM_KOSONG = { nama_kelompok:'', tingkatan:'caberawit', desa:'', daerah:'' };

function IlusWelcome({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} fill="none">
      <circle cx="48" cy="22" r="4" fill="var(--color-accent)" />
      <path d="M48 30 L70 46 H64 V70 H56 V54 H40 V70 H32 V46 H26 Z" fill="var(--color-primary)" />
      <rect x="44" y="58" width="8" height="12" rx="2" fill="var(--color-brand-soft)" />
      <rect x="20" y="70" width="56" height="6" rx="3" fill="var(--color-brand-soft)" />
    </svg>
  );
}

function IlusBuatKelompok({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} fill="none">
      <circle cx="36" cy="46" r="14" fill="var(--color-brand-soft)" />
      <circle cx="36" cy="40" r="7" fill="var(--color-primary)" />
      <path d="M22 60c0-8 6-13 14-13s14 5 14 13" fill="var(--color-primary)" />
      <circle cx="66" cy="32" r="13" fill="var(--color-accent)" />
      <path d="M66 26v12M60 32h12" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function IlusTambahMurid({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} fill="none">
      <circle cx="32" cy="30" r="7" fill="var(--color-primary)" />
      <rect x="46" y="26" width="28" height="8" rx="4" fill="var(--color-brand-soft)" />
      <circle cx="32" cy="52" r="7" fill="var(--color-accent)" />
      <rect x="46" y="48" width="28" height="8" rx="4" fill="var(--color-brand-soft)" />
      <circle cx="32" cy="74" r="7" fill="var(--color-primary)" opacity="0.45" />
      <rect x="46" y="70" width="18" height="8" rx="4" fill="var(--color-brand-soft)" />
    </svg>
  );
}

function IlusMulaiAbsensi({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} fill="none">
      <rect x="24" y="20" width="40" height="56" rx="7" fill="var(--color-brand-soft)" />
      <rect x="36" y="16" width="16" height="9" rx="3.5" fill="var(--color-primary)" />
      <rect x="32" y="40" width="22" height="5" rx="2.5" fill="var(--color-primary)" opacity="0.55" />
      <rect x="32" y="50" width="16" height="5" rx="2.5" fill="var(--color-primary)" opacity="0.3" />
      <circle cx="66" cy="60" r="16" fill="var(--color-accent)" />
      <path d="M59 60l5 5 10-11" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IlusLihatRekap({ className }) {
  return (
    <svg viewBox="0 0 96 96" className={className} fill="none">
      <rect x="22" y="52" width="12" height="24" rx="4" fill="var(--color-primary)" opacity="0.4" />
      <rect x="42" y="38" width="12" height="38" rx="4" fill="var(--color-primary)" opacity="0.7" />
      <rect x="62" y="24" width="12" height="52" rx="4" fill="var(--color-primary)" />
      <path d="M22 34l14-10 12 8 16-14" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M56 15l8 3-2 8" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // SWR: tampilkan cache instan, revalidate di background
  const { data: kelompokData, isLoading: loadingKelompok, mutate: mutateKelompok } = useSWR(
    session ? '/api/kelompok' : null
  );
  // Bulan berjalan, dipakai untuk key SWR sekaligus label di card kelompok
  const bulanIni = useMemo(() => {
    const now = new Date();
    const nilai = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const label = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return { nilai, label };
  }, []);

  const { data: rekapRingkasData, mutate: mutateRekapRingkas } = useSWR(
    session ? `/api/rekap-ringkas?bulan=${bulanIni.nilai}` : null
  );

  const kelompok = Array.isArray(kelompokData) ? kelompokData : [];
  const rekapRingkas = rekapRingkasData || {};
  const loading = status === 'loading' || loadingKelompok;

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [saving, setSaving] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);
  const [hapusing, setHapusing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [filterTingkatan, setFilterTingkatan] = useState('semua');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (session) init();
  }, [session]);

  useEffect(() => {
    if (status === 'authenticated' && !loading) {
      if (searchParams.get('baru') === '1') bukaModalBaru();
      if (searchParams.get('panduan') === '1') { setShowOnboarding(true); setOnboardStep(0); }
      if (searchParams.toString()) router.replace('/dashboard', { scroll: false });
    }
  }, [searchParams, status, loading]);

  async function init() {
    try { await fetch('/api/init', { method: 'POST' }); } catch (e) {}
    mutateRekapRingkas();
    const seen = localStorage.getItem('onboarding_done');
    if (!seen) setShowOnboarding(true);
  }

  function bukaModalBaru() {
    setEditTarget(null);
    setForm(FORM_KOSONG);
    setShowModal(true);
  }

  function bukaModalEdit(k, e) {
    e.stopPropagation();
    setEditTarget(k);
    setForm({ nama_kelompok: k.nama_kelompok, tingkatan: k.tingkatan, desa: k.desa, daerah: k.daerah });
    setShowModal(true);
  }

  async function handleSimpan(e) {
    e.preventDefault();
    setSaving(true);
    if (editTarget) {
      await fetch(`/api/kelompok/${editTarget.id}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      mutateKelompok();
      setShowModal(false);
    } else {
      const res = await fetch('/api/kelompok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const baru = await res.json();
        setShowModal(false);
        setForm(FORM_KOSONG);
        router.push(`/setup/${baru.id}`);
      }
    }
    setSaving(false);
  }

  async function handleHapus() {
    if (!hapusTarget) return;
    setHapusing(true);
    await fetch(`/api/kelompok/${hapusTarget.id}/edit`, { method: 'DELETE' });
    mutateKelompok();
    setHapusTarget(null);
    setHapusing(false);
  }

  function selesaiOnboarding() {
    localStorage.setItem('onboarding_done', '1');
    setShowOnboarding(false);
  }

  const hariIni = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' });
  const kelompokTampil = filterTingkatan === 'semua'
    ? kelompok
    : kelompok.filter(k => k.tingkatan === filterTingkatan);

  const ONBOARD_STEPS = [
    { Illus: IlusWelcome, judul:'Selamat Datang!', isi:'Absensi Generus membantu Anda mencatat kehadiran murid pengajian dengan mudah langsung dari HP.' },
    { Illus: IlusBuatKelompok, judul:'Buat Kelompok', isi:'Mulai dengan membuat kelompok pengajian. Isi nama kelompok, tingkatan, desa, dan daerah.' },
    { Illus: IlusTambahMurid, judul:'Tambah Murid', isi:'Setelah buat kelompok, tambahkan nama-nama murid dan tentukan jadwal ngaji mingguan.' },
    { Illus: IlusMulaiAbsensi, judul:'Mulai Absensi', isi:'Tiap hari ngaji, buka kelompok → tap Absen → tandai Hadir/Izin/Sakit/Alfa → Simpan. Selesai!' },
    { Illus: IlusLihatRekap, judul:'Lihat Rekap', isi:'Pantau persentase kehadiran per murid, per hari, minggu, atau bulan kapan saja.' },
  ];

  if (loading) return (
    <AppScreen>
      <div className="space-y-4 px-5 pt-8">
        <div className="flex items-center gap-3">
          <div className="size-11 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-36 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
        <div className="h-10 w-56 animate-pulse rounded-2xl bg-muted" />
        {[0,1,2].map(i => <div key={i} className="h-40 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />)}
      </div>
    </AppScreen>
  );

  return (
    <>
      <AppScreen>
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 pt-6">
          <div className="flex min-w-0 items-center gap-3">
            {session?.user?.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={session.user.image}
                alt={session.user.name}
                className="size-11 shrink-0 rounded-full object-cover"
                onError={e => { e.currentTarget.src = userAvatar.src; }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={userAvatar.src} alt={session?.user?.name || 'User'} className="size-11 shrink-0 rounded-full object-cover" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{hariIni}</p>
              <p className="truncate text-base font-bold text-ink">{session?.user?.name?.split(' ')[0]}</p>
            </div>
          </div>
          <button
            aria-label="Panduan"
            onClick={() => { setShowOnboarding(true); setOnboardStep(0); }}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
          >
            <CircleHelp className="size-5 text-ink" />
          </button>
        </header>

        <h1 className="px-5 pt-7 text-[2.15rem] leading-[1.1] font-extrabold tracking-tight text-ink">
          Kelompok
          <br />
          Saya
        </h1>

        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {[
            { key: 'semua', label: 'Semua' },
            ...Object.entries(TINGKATAN_LABEL).map(([key, val]) => ({ key, label: val.label })),
          ].map(({ key, label }) => {
            const count = key === 'semua' ? kelompok.length : kelompok.filter(k => k.tingkatan === key).length;
            if (count === 0 && key !== 'semua') return null;
            const isActive = filterTingkatan === key;
            return (
              <button
                key={key}
                onClick={() => setFilterTingkatan(key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-ink text-primary-foreground'
                    : 'bg-surface text-muted-foreground shadow-[var(--shadow-card)]'
                }`}
              >
                {key === 'semua'
                  ? <LayoutGrid className="size-3.5" />
                  : <TingkatanIcon tingkatan={key} className="size-3.5" />}
                <span>{label}</span>
                <span className={`rounded-full px-1.5 text-[11px] font-bold ${isActive ? 'bg-white/25' : 'bg-border'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {kelompok.length > 1 && (
          <div className="px-5 pt-4">
            <button
              onClick={() => router.push('/rekap')}
              className="flex w-full items-center gap-3 rounded-3xl p-4 text-left brand-gradient text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/20">
                <BarChart3 className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Rekap Gabungan</p>
                <p className="text-xs text-primary-foreground/80">Lihat rekap semua kelompok yang bisa kamu akses</p>
              </div>
              <ChevronRight className="size-4 shrink-0" />
            </button>
          </div>
        )}

        {kelompok.length === 0 ? (
          <div className="card-soft mx-5 mt-5 p-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-primary">
              <Landmark className="size-7" />
            </div>
            <h3 className="mt-3 text-base font-extrabold text-ink">Belum ada kelompok</h3>
            <p className="mt-1 text-sm text-muted-foreground">Mulai dengan membuat kelompok pengajian pertama Anda</p>
            <button
              onClick={bukaModalBaru}
              className="mt-4 w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]"
            >
              Buat Kelompok Pertama
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4 px-5">
            {kelompokTampil.length === 0 && (
              <div className="py-10 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-primary">
                  {(() => { const t = getTingkatan(filterTingkatan); const I = t.Icon; return <I className="size-6" />; })()}
                </div>
                <p className="mt-2 text-sm font-bold text-ink">Tidak ada kelompok {getTingkatan(filterTingkatan).label}</p>
                <p className="text-xs text-muted-foreground">Coba pilih tingkatan lain</p>
              </div>
            )}
            {kelompokTampil.map((k, i) => {
              const tk = getTingkatan(k.tingkatan);
              const rk = rekapRingkas[k.id];
              const persen = rk?.persen ?? null;
              const persenColor = persen === null ? 'bg-border'
                : persen >= 80 ? 'bg-primary'
                : persen >= 60 ? 'bg-amber-500'
                : 'bg-destructive';
              const featured = false; // semua card kelompok pakai style putih; "Rekap Gabungan" di atas tetap biru terpisah
              return (
                <div
                  key={k.id}
                  onClick={() => router.push(`/absensi/${k.id}`)}
                  className={`block cursor-pointer rounded-3xl p-4 transition-transform active:scale-[0.99] ${
                    featured
                      ? 'brand-gradient text-primary-foreground shadow-[var(--shadow-float)]'
                      : 'card-soft'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`truncate text-sm font-bold ${featured ? '' : 'text-ink'}`}>{k.nama_kelompok}</span>
                    <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${featured ? 'bg-white/20' : 'bg-secondary text-muted-foreground'}`}>
                      <TingkatanIcon tingkatan={k.tingkatan} className="size-3.5" />
                      {tk.label}
                    </span>
                  </div>

                  <p className={`mt-1.5 flex items-center gap-1 truncate text-xs ${featured ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    <MapPin className="size-3 shrink-0" /> {k.desa}
                    <span className="opacity-60">·</span>
                    <Map className="size-3.5 shrink-0" /> {k.daerah}
                  </p>

                  <div className="mt-4" onClick={e => { e.stopPropagation(); router.push(`/rekap/${k.id}`); }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold ${featured ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {bulanIni.label}{rk ? ` · ${rk.total_murid} murid` : ''}
                      </span>
                      <span
                        className="text-sm font-extrabold"
                        style={persen !== null ? { color: persen >= 80 ? '#22c55e' : persen >= 60 ? '#d97706' : '#ef4444' } : { opacity: featured ? 0.8 : 1, color: featured ? undefined : 'var(--muted-foreground)' }}
                      >
                        {persen === null ? (rk === undefined ? '…' : 'Belum ada data') : `${persen}%`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: featured ? 'rgba(255,255,255,.25)' : 'var(--border)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: persen !== null ? `${persen}%` : '0%',
                          background: persen === null
                            ? 'transparent'
                            : featured ? '#fff' : (persen >= 80 ? '#22c55e' : persen >= 60 ? '#d97706' : '#ef4444'),
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    {(k.permission === 'owner' || k.permission === 'absen') && (
                      <button onClick={e => { e.stopPropagation(); router.push(`/absensi/${k.id}`); }} className="flex items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground">
                        <CheckCircle2 className="size-3.5" /> Absen
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); router.push(`/rekap/${k.id}`); }} className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold ${featured ? 'bg-white/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      <BarChart3 className="size-3.5" /> Rekap
                    </button>
                    {k.permission === 'owner' && (
                      <button onClick={e => { e.stopPropagation(); router.push(`/setup/${k.id}`); }} className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold ${featured ? 'bg-white/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        <Settings className="size-3.5" /> Kelola
                      </button>
                    )}
                    {k.permission === 'owner' && (
                      <button onClick={e => { e.stopPropagation(); router.push(`/admin/${k.id}`); }} className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold ${featured ? 'bg-white/20 text-primary-foreground' : 'bg-brand-soft text-primary'}`}>
                        <Users className="size-3.5" /> Admin
                      </button>
                    )}
                    {k.permission === 'owner' && (
                      <button aria-label="Edit" onClick={e => bukaModalEdit(k, e)} className={`grid size-8 place-items-center rounded-full ${featured ? 'bg-white/20 text-primary-foreground' : 'bg-brand-soft text-primary'}`}>
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {k.permission === 'owner' && (
                      <button aria-label="Hapus" onClick={e => { e.stopPropagation(); setHapusTarget(k); }} className="grid size-8 place-items-center rounded-full bg-destructive/10 text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </AppScreen>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" onClick={() => setShowModal(false)}>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8 shadow-[var(--shadow-float)]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold text-ink">{editTarget ? 'Edit Kelompok' : 'Kelompok Baru'}</span>
              <button aria-label="Tutup" onClick={() => setShowModal(false)} className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground"><X className="size-4" /></button>
            </div>
            <form onSubmit={handleSimpan} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nama Kelompok</label>
                <input placeholder="cth: Kelompok Masjid Al-Ikhlas" value={form.nama_kelompok} onChange={e => setForm({...form, nama_kelompok: e.target.value})} required
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tingkatan Ngaji</label>
                <select value={form.tingkatan} onChange={e => setForm({...form, tingkatan: e.target.value})}
                  className="w-full appearance-none rounded-2xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="caberawit">Caberawit</option>
                  <option value="praremaja">Pra Remaja</option>
                  <option value="remaja">Remaja</option>
                  <option value="usianikah">Usia Nikah</option>
                  <option value="kelompok">Ngaji Kelompok</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Desa</label>
                <input placeholder="cth: Sukamaju" value={form.desa} onChange={e => setForm({...form, desa: e.target.value})} required
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Daerah</label>
                <input placeholder="cth: Daerah Kediri" value={form.daerah} onChange={e => setForm({...form, daerah: e.target.value})} required
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full rounded-full brand-gradient py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Simpan & Lanjut Setup'}
              </button>
            </form>
          </div>
        </div>
      )}

      {hapusTarget && (
        <div className="fixed inset-0 z-50 bg-ink/40" onClick={() => setHapusTarget(null)}>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8 text-center shadow-[var(--shadow-float)]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert className="size-7" />
            </div>
            <h3 className="mt-3 text-lg font-extrabold text-ink">Hapus Kelompok?</h3>
            <p className="mt-1 truncate text-sm font-semibold text-ink">{hapusTarget.nama_kelompok}</p>
            <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
              Semua data murid, jadwal, dan absensi akan ikut terhapus permanen!
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setHapusTarget(null)} className="flex-1 rounded-full bg-secondary py-3.5 text-sm font-bold text-ink">Batal</button>
              <button onClick={handleHapus} disabled={hapusing} className="flex-1 rounded-full bg-destructive py-3.5 text-sm font-bold text-destructive-foreground active:scale-[0.99] disabled:opacity-60">
                {hapusing ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-ink/40" onClick={selesaiOnboarding}>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8 text-center shadow-[var(--shadow-float)]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <div className="mb-5 flex justify-center gap-1.5">
              {ONBOARD_STEPS.map((_, i) => (
                <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === onboardStep ? 'w-6 bg-primary' : 'w-2 bg-border'}`} />
              ))}
            </div>
            <div className="mx-auto flex size-24 items-center justify-center">
              {(() => { const Ilus = ONBOARD_STEPS[onboardStep].Illus; return <Ilus className="size-24" />; })()}
            </div>
            <h2 className="mt-3 text-xl font-extrabold text-ink">{ONBOARD_STEPS[onboardStep].judul}</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{ONBOARD_STEPS[onboardStep].isi}</p>
            <div className="mt-6 flex gap-3">
              {onboardStep > 0 && (
                <button onClick={() => setOnboardStep(s=>s-1)} className="flex-1 rounded-full bg-secondary py-3.5 text-sm font-bold text-ink">Kembali</button>
              )}
              {onboardStep < ONBOARD_STEPS.length-1
                ? <button onClick={() => setOnboardStep(s=>s+1)} className="flex-1 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]">Lanjut</button>
                : <button onClick={selesaiOnboarding} className="flex-1 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]">Mulai</button>
              }
            </div>
            <button onClick={selesaiOnboarding} className="mt-3 text-xs font-semibold text-muted-foreground">Lewati</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <AppScreen>
        <div className="space-y-4 px-5 pt-8">
          <div className="h-10 w-56 animate-pulse rounded-2xl bg-muted" />
        </div>
      </AppScreen>
    }>
      <DashboardContent />
    </Suspense>
  );
}
