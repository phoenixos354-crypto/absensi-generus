'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppScreen } from '@/components/AppScreen';
import { BackButton } from '@/components/BackButton';
import { TingkatanIcon, getTingkatan } from '@/components/tingkatan';
import { MapPin, Users, ClipboardList, ArrowLeft, Save, Check, NotebookPen, Wallet } from 'lucide-react';

const STATUS_LIST = ['Hadir','Izin','Sakit','Alfa'];

const STATUS_COLOR = {
  Hadir: { border:'#22c55e', bg:'#22c55e', text:'white', pale:'#dcfce7', paleText:'#166534' },
  Izin:  { border:'#eab308', bg:'#eab308', text:'white', pale:'#fef9c3', paleText:'#854d0e' },
  Sakit: { border:'#3b82f6', bg:'#3b82f6', text:'white', pale:'#dbeafe', paleText:'#1e40af' },
  Alfa:  { border:'#ef4444', bg:'#ef4444', text:'white', pale:'#fee2e2', paleText:'#991b1b' },
};

export default function AbsensiPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  const [kelompok, setKelompok] = useState(null);
  const [murid, setMurid] = useState([]);
  const [absensiMap, setAbsensiMap] = useState({}); // murid_id -> status
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jurnal, setJurnal] = useState('');
  const [infaq, setInfaq] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingLoaded, setExistingLoaded] = useState(false);
  const [gagalMuat, setGagalMuat] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (session && kelompokId) fetchKelompok();
  }, [session, kelompokId]);

  useEffect(() => {
    if (murid.length > 0) loadAbsensiTanggal();
  }, [tanggal, murid]);

  useEffect(() => {
    if (kelompokId) loadSesiTanggal();
  }, [tanggal, kelompokId]);

  async function loadSesiTanggal() {
    const res = await fetch(`/api/sesi?kelompok_id=${kelompokId}&tanggal=${tanggal}`);
    const data = await res.json();
    const sesi = Array.isArray(data) ? data[0] : null;
    setJurnal(sesi?.jurnal || '');
    setInfaq(sesi?.infaq && Number(sesi.infaq) > 0 ? String(sesi.infaq) : '');
  }

  async function fetchKelompok() {
    setLoading(true);
    setGagalMuat(false);

    // Coba beberapa kali dulu — jangan langsung dilempar ke dashboard
    // kalau gagalnya cuma gangguan sesaat (mis. server lagi rame).
    let res;
    for (let percobaan = 0; percobaan < 3; percobaan++) {
      try {
        res = await fetch(`/api/kelompok/${kelompokId}`);
      } catch {
        res = null;
      }
      if (res?.ok) break;
      if (res && [401, 403, 404].includes(res.status)) break; // error akses, jangan diulang
      if (percobaan < 2) await new Promise(r => setTimeout(r, 600 * (percobaan + 1)));
    }

    if (!res) { setLoading(false); setGagalMuat(true); return; }
    if ([401, 403, 404].includes(res.status)) { router.replace('/dashboard'); return; }
    if (!res.ok) { setLoading(false); setGagalMuat(true); return; }

    const data = await res.json();
    // Viewer tidak boleh absen
    if (data.permission === 'viewer') {
      router.replace(`/rekap/${kelompokId}`);
      return;
    }
    setKelompok(data);
    setMurid(data.murid || []);
    setLoading(false);
  }

  async function loadAbsensiTanggal() {
    setExistingLoaded(false);
    const res = await fetch(`/api/absensi?kelompok_id=${kelompokId}&tanggal=${tanggal}`);
    const data = await res.json();
    const map = {};
    if (Array.isArray(data)) {
      data.forEach(a => { map[a.murid_id] = a.status; });
    }
    // Default semua ke Hadir jika belum ada data
    if (Object.keys(map).length === 0) {
      murid.forEach(m => { map[m.id] = 'Hadir'; });
    }
    setAbsensiMap(map);
    setExistingLoaded(true);
    setSaved(false);
  }

  function setStatus(muridId, status) {
    setAbsensiMap(prev => ({ ...prev, [muridId]: status }));
    setSaved(false);
  }

  // Set semua murid ke satu status
  function setAllStatus(status) {
    const map = {};
    murid.forEach(m => { map[m.id] = status; });
    setAbsensiMap(map);
    setSaved(false);
  }

  const [showKonfirmasi, setShowKonfirmasi] = useState(false);

  async function handleSimpan() {
    setSaving(true);
    const absensiArr = murid.map(m => ({
      murid_id: m.id,
      status: absensiMap[m.id] || 'Alfa',
    }));
    const [resAbsensi, resSesi] = await Promise.all([
      fetch('/api/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kelompok_id: kelompokId, tanggal, absensi: absensiArr }),
      }),
      fetch('/api/sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kelompok_id: kelompokId, tanggal, jurnal, infaq }),
      }),
    ]);
    if (resAbsensi.ok && resSesi.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  // Hitung ringkasan
  const summary = STATUS_LIST.reduce((acc, s) => {
    acc[s] = murid.filter(m => absensiMap[m.id] === s).length;
    return acc;
  }, {});

  const persen = murid.length > 0
    ? Math.round((summary['Hadir'] / murid.length) * 100)
    : 0;

  if (gagalMuat) return (
    <AppScreen>
      <div className="px-5 pt-16 text-center">
        <p className="text-sm font-semibold text-ink">Gagal memuat data kelompok</p>
        <p className="mt-1 text-xs text-muted-foreground">Sepertinya ada gangguan sesaat. Coba lagi ya.</p>
        <button
          onClick={fetchKelompok}
          className="mt-4 rounded-full brand-gradient px-6 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]"
        >
          Coba Lagi
        </button>
      </div>
    </AppScreen>
  );

  if (loading || !kelompok) return (
    <AppScreen>
      <div className="space-y-4 px-5 pt-8">
        <div className="h-36 animate-pulse rounded-b-[2rem] brand-gradient" />
        <div className="h-32 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        <div className="h-16 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        <div className="h-16 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
      </div>
    </AppScreen>
  );

  const tk = getTingkatan(kelompok.tingkatan);

  return (
    <AppScreen>
      <div className="relative">
        {/* Header hero */}
        <div className="brand-gradient relative overflow-hidden rounded-b-[2rem] pt-6 text-primary-foreground">
          <div className="flex items-center justify-between px-5">
            <BackButton
              fallbackHref="/dashboard"
              className="grid size-10 place-items-center rounded-full bg-white/20"
              iconClassName="size-5"
            />
            <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">
              <MapPin className="size-3" /> {kelompok.desa}
            </span>
          </div>
          <div className="px-5 pb-6 pt-4">
            <h1 className="text-2xl leading-tight font-extrabold">{kelompok.nama_kelompok}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/80">
              <TingkatanIcon tingkatan={kelompok.tingkatan} className="size-3.5" />
              {tk.label} · {murid.length} murid
            </p>
          </div>
        </div>

        {/* Tanggal + set semua + ringkasan */}
        <section className="px-5 pt-5">
          <div className="card-soft p-4">
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tanggal Absensi</label>
            <input
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-primary/40"
            />

            <p className="mt-4 text-xs font-semibold text-muted-foreground">Set semua murid:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STATUS_LIST.map(s => {
                const c = STATUS_COLOR[s];
                return (
                  <button
                    key={s}
                    onClick={() => setAllStatus(s)}
                    className="rounded-full border bg-surface px-3.5 py-2 text-xs font-bold transition-colors active:scale-[0.98]"
                    style={{ borderColor: c.border, color: c.paleText }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="flex justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Kehadiran hari ini</span>
                <span className="text-sm font-extrabold text-primary">{persen}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${persen}%` }} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {STATUS_LIST.map(s => {
                  const c = STATUS_COLOR[s];
                  return (
                    <span key={s} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: c.pale, color: c.paleText }}>
                      {s}: {summary[s]}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Daftar murid */}
        <section className="px-5 pt-5">
          {murid.length === 0 ? (
            <div className="card-soft p-6 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-primary">
                <Users className="size-6" />
              </div>
              <h3 className="mt-3 text-base font-extrabold text-ink">Belum ada murid</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tambahkan murid terlebih dahulu</p>
              <button onClick={() => router.push(`/setup/${kelompokId}`)} className="mt-4 w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)]">
                Setup Murid
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {murid.map((m, i) => {
                const currentStatus = absensiMap[m.id] || 'Hadir';
                return (
                  <li key={m.id} className="card-soft flex items-center gap-3 p-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-extrabold text-primary">{i+1}</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{m.nama_murid}</p>
                    <div className="flex shrink-0 gap-1">
                      {STATUS_LIST.map(s => {
                        const c = STATUS_COLOR[s];
                        const aktif = currentStatus === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setStatus(m.id, s)}
                            className="rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all active:scale-[0.95]"
                            style={aktif
                              ? { background: c.bg, color: c.text }
                              : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Catatan Sesi: Jurnal & Infaq */}
        {murid.length > 0 && (
          <section className="px-5 pt-5">
            <div className="card-soft p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                  <NotebookPen className="size-4" />
                </span>
                <h2 className="text-sm font-extrabold text-ink">Catatan Sesi</h2>
              </div>

              <label className="mt-3.5 mb-1.5 block text-xs font-semibold text-muted-foreground">
                Jurnal / Materi Hari Ini
              </label>
              <textarea
                value={jurnal}
                onChange={e => { setJurnal(e.target.value); setSaved(false); }}
                placeholder="Contoh: Materi akhlak, cerita nabi, tanya jawab..."
                rows={3}
                className="w-full resize-none rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-ink outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/40"
              />

              <label className="mt-4 mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Wallet className="size-3.5" /> Infaq Masuk (opsional)
              </label>
              <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 focus-within:ring-2 focus-within:ring-primary/40">
                <span className="text-sm font-bold text-muted-foreground">Rp</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={infaq}
                  onChange={e => { setInfaq(e.target.value); setSaved(false); }}
                  placeholder="0"
                  className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                />
              </div>
            </div>
          </section>
        )}

        {/* Spacer agar konten bawah tidak tertutup bar melayang */}
        {murid.length > 0 && <div className="h-40" />}

        {/* Tombol melayang */}
        {murid.length > 0 && (
          <div className="pointer-events-none fixed bottom-[5.75rem] left-1/2 z-40 w-full max-w-[26rem] -translate-x-1/2 px-5">
            <div className="pointer-events-auto flex gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 rounded-full bg-surface px-5 py-3.5 text-sm font-bold text-ink shadow-[var(--shadow-card)]"
              >
                <ArrowLeft className="size-4" /> Kembali
              </button>
              <button
                onClick={() => setShowKonfirmasi(true)}
                disabled={saving}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold shadow-[var(--shadow-float)] transition-transform active:scale-[0.99] disabled:opacity-60 ${
                  saved ? 'bg-primary text-primary-foreground' : 'brand-gradient text-primary-foreground shadow-[var(--shadow-float)]'
                }`}
              >
                {saved ? <Check className="size-4" /> : <Save className="size-4" />}
                {saving ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan Absensi'}
              </button>
            </div>
          </div>
        )}

        {/* Modal konfirmasi simpan */}
        {showKonfirmasi && (
          <div className="fixed inset-0 z-50 bg-ink/40" onClick={() => setShowKonfirmasi(false)}>
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8 text-center shadow-[var(--shadow-float)]" onClick={e => e.stopPropagation()}>
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-primary">
                <ClipboardList className="size-7" />
              </div>
              <h3 className="mt-3 text-lg font-extrabold text-ink">Konfirmasi Absensi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(tanggal).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
              </p>
              <div className="mt-4 flex justify-center gap-2 flex-wrap">
                {STATUS_LIST.map(s => {
                  const c = STATUS_COLOR[s];
                  return (
                    <div key={s} className="rounded-2xl px-3.5 py-2" style={{ background: c.pale, color: c.paleText }}>
                      <div className="text-xl font-extrabold">{summary[s]}</div>
                      <div className="text-[11px] font-semibold">{s}</div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Total {murid.length} murid · Kehadiran <strong className="text-primary">{persen}%</strong>
              </p>
              {Number(infaq) > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Infaq: <strong className="text-primary">Rp{Number(infaq).toLocaleString('id-ID')}</strong>
                </p>
              )}
              <div className="mt-5 flex gap-3">
                <button onClick={() => setShowKonfirmasi(false)} className="flex-1 rounded-full bg-secondary py-3.5 text-sm font-bold text-ink">Cek Lagi</button>
                <button onClick={() => { setShowKonfirmasi(false); handleSimpan(); }} className="flex-1 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]">
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </AppScreen>
  );
}
