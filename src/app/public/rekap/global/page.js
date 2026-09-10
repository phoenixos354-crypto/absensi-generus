'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Star, Percent, Layers, CheckCircle2, Trophy, MapPin, ChevronRight, ClipboardList } from 'lucide-react';

function sensorNama(nama, index) {
  return `Murid ${index + 1}`;
}

function getBulanList() {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    result.push({ val, label });
  }
  return result;
}

function getPersenWarna(persen) {
  if (persen === null) return { bar: '#e5e7eb', text: '#9ca3af', chip: '#f3f4f6' };
  if (persen >= 80) return { bar: '#22c55e', text: '#16a34a', chip: '#dcfce7' };
  if (persen >= 60) return { bar: '#eab308', text: '#ca8a04', chip: '#fef9c3' };
  return { bar: '#f97316', text: '#ea580c', chip: '#ffedd5' };
}

export default function PublicRekapGlobalPage() {
  const router = useRouter();
  const bulanList = getBulanList();
  const [nilai, setNilai] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('nilai')) return p.get('nilai');
      if (p.get('mode') === 'bulan' && p.get('nilai')) return p.get('nilai');
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tabTingkatan, setTabTingkatan] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('tingkatan') || 'caberawit';
    }
    return 'caberawit';
  });
  const [displayMode, setDisplayMode] = useState('nama');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const kelompokIds = params.get('kelompok_ids') || '';
        const url = `/api/public/rekap/global?mode=bulan&nilai=${nilai}&tingkatan=${tabTingkatan}${kelompokIds ? `&kelompok_ids=${kelompokIds}` : ''}`;
        const res = await fetch(url);
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      }
      setLoading(false);
    }
    fetchData();
  }, [nilai, tabTingkatan]);

  const tabTersedia = useMemo(() => {
    const counts = data?.tingkatan_counts || {};
    const labels = {
      caberawit: 'Caberawit',
      praremaja: 'Praremaja',
      remaja: 'Remaja',
      dewasa: 'Dewasa',
    };
    return Object.entries(labels)
      .filter(([key]) => counts[key] > 0)
      .map(([key, label]) => ({ key, label, count: counts[key] }));
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="h-12 w-1/3 animate-pulse rounded bg-gray-200" />
          <div className="h-24 animate-pulse rounded bg-gray-200" />
          <div className="h-40 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center text-gray-500">Gagal memuat data.</div>
      </div>
    );
  }

  const bulanLabel = new Date(nilai + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const infoWilayah = (() => {
    const list = data.kelompok_list || [];
    if (list.length === 0) return null;
    const daerahSet = new Set(list.map(k => k.daerah).filter(Boolean));
    const desaSet = new Set(list.map(k => k.desa).filter(Boolean));
    if (daerahSet.size === 1) {
      return desaSet.size === 1
        ? `${[...desaSet][0]} · ${[...daerahSet][0]}`
        : [...daerahSet][0];
    }
    return `${list.length} Kelompok`;
  })();

  return (
    <div className="min-h-screen bg-white">
      {/* Header gradient */}
      <header className="relative overflow-hidden px-5 pb-8 pt-6" style={{ background: 'linear-gradient(160deg,#155dfc 0%,#1447c9 100%)' }}>
        <div className="relative z-10">
          <div className="text-center text-white">
            <h1 className="text-3xl font-extrabold leading-tight">Rekap Absensi Ngaji</h1>
            <p className="text-3xl font-extrabold leading-tight">{bulanLabel}</p>
            {infoWilayah && <p className="mt-1.5 text-sm text-white/80">{infoWilayah}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-white/80">
              <span className="flex items-center gap-1"><Layers className="size-3.5" /> {tabTersedia.length || 0} Tingkatan</span>
              <span className="flex items-center gap-1"><Users className="size-3.5" /> {data.stats?.total_murid ?? 0} murid</span>
            </div>
          </div>
        </div>
      </header>

      {/* Filter bulan */}
      <section className="mx-auto max-w-4xl px-5 pt-5">
        <div className="rounded-2xl bg-white p-4 shadow">
          <select
            value={nilai}
            onChange={e => setNilai(e.target.value)}
            className="w-full appearance-none rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
          >
            {bulanList.map(b => <option key={b.val} value={b.val}>{b.label}</option>)}
          </select>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5">
        {/* Tabs tingkatan */}
        {tabTersedia.length > 0 && (
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
            {tabTersedia.map(t => (
              <button
                key={t.key}
                onClick={() => setTabTingkatan(t.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  tabTingkatan === t.key
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <span>{t.label}</span>
                <span className={`rounded-full px-1.5 text-[11px] font-bold ${tabTingkatan === t.key ? 'bg-white/25' : 'bg-gray-300'}`}>{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Stat cards */}
        <section className="pt-5">
          <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
            <StatCard icon={Users} iconBg="#dbeafe" iconColor="#2563eb" value={data.stats.total_murid} label="Total Murid" />
            <StatCard icon={Star} iconBg="#dcfce7" iconColor="#16a34a" value={data.stats.hadir_100} label="Hadir 100%" />
            <StatCard icon={Percent} iconBg="#ffedd5" iconColor="#ea580c" value={`${data.stats.avg_persen}%`} label="Rata-rata Hadir" />
            <StatCard icon={Layers} iconBg="#f3e8ff" iconColor="#9333ea" value={data.stats.kelompok_aktif} label="Kelompok Aktif" />
            <StatCard icon={CheckCircle2} iconBg="#dbeafe" iconColor="#2563eb" value={data.stats.total_hadir} label="Total Hadir" />
          </div>
        </section>

        {/* Perbandingan kelompok */}
        {data.kelompok_list.length > 0 && (
          <section className="pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold">Perbandingan Kelompok</h2>
              <span className="text-[11px] font-semibold text-gray-500">% Kehadiran</span>
            </div>
            <div className="space-y-3.5 rounded-2xl bg-white p-4 shadow">
              {data.kelompok_list.map(k => {
                const w = getPersenWarna(k.persen);
                return (
                  <div key={k.id} className="block w-full">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-bold">{k.nama_kelompok}</span>
                      <span className="shrink-0 font-extrabold" style={{ color: w.text }}>
                        {k.persen === null ? '–' : `${k.persen}%`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="flex h-full items-center rounded-full px-2 text-[10px] font-bold text-white transition-all duration-500"
                        style={{ width: `${Math.max(k.persen ?? 0, k.persen ? 10 : 0)}%`, background: w.bar }}
                      >
                        {k.persen !== null && k.persen >= 15 ? `${k.persen}%` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Murid terbaik with toggle */}
        {data.top_murid.length > 0 && (
          <section className="pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold">Murid Terbaik</h2>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setDisplayMode('nama')}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    displayMode === 'nama'
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Nama
                </button>
                <button
                  onClick={() => setDisplayMode('sensor')}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    displayMode === 'sensor'
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Sensor
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {data.top_murid.map((m, i) => {
                const displayName = displayMode === 'sensor' ? sensorNama(m.nama, i) : m.nama;
                return (
                  <div key={m.murid_id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                      i < 3 ? 'bg-amber-400' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {i < 3 ? <Trophy className="size-4" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{displayName}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                        <MapPin className="size-3 shrink-0" /> {m.nama_kelompok}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold text-blue-600">100%</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, iconBg, iconColor, value, label }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-3 shadow">
      <span className="grid size-7 place-items-center rounded-full" style={{ background: iconBg, color: iconColor }}>
        <Icon className="size-3.5" />
      </span>
      <p className="mt-1.5 truncate text-lg font-extrabold">{value}</p>
      <p className="truncate text-[10px] leading-tight text-gray-500">{label}</p>
    </div>
  );
}