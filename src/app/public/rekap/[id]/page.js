'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calendar, CalendarRange, CalendarDays, Users, ClipboardList, CheckCircle2, NotebookPen, Wallet, TrendingDown, TrendingUp, MinusCircle } from 'lucide-react';

function sensorNama(nama, index) {
  return `Murid ${index + 1}`;
}

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

function getPersenColor(persen) {
  if (persen >= 80) return '#16a34a';
  if (persen >= 60) return '#ca8a04';
  return '#dc2626';
}

function formatRupiah(n) {
  return Number(n || 0).toLocaleString('id-ID');
}

export default function PublicRekapPage() {
  const params = useParams();
  const kelompokId = params.id;
  const [mode, setMode] = useState('bulan');
  const [nilai, setNilai] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState('persen');

  const bulanList = getBulanList();
  const mingguList = getMingguList();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/rekap/${kelompokId}?mode=${mode}&nilai=${nilai}`);
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      }
      setLoading(false);
    }
    fetchData();
  }, [kelompokId, mode, nilai]);

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

  const periodeLabel = mode === 'hari'
    ? new Date(nilai).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })
    : mode === 'minggu'
    ? `Minggu ${nilai}`
    : new Date(nilai+'-01').toLocaleDateString('id-ID', { month:'long', year:'numeric' });

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold">{data.kelompok_nama}</h1>
          <p className="text-sm text-gray-500">{data.desa} · {data.tingkatan}</p>
          <p className="mt-1 text-sm font-semibold text-blue-600">{periodeLabel}</p>
        </div>

        {/* Filter */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow">
          <div className="flex gap-2">
            {['hari','minggu','bulan'].map(m => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  mode === m
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {m === 'hari' ? <Calendar className="mr-1 inline size-4" /> : m === 'minggu' ? <CalendarRange className="mr-1 inline size-4" /> : <CalendarDays className="mr-1 inline size-4" />}
                {m === 'hari' ? 'Hari' : m === 'minggu' ? 'Minggu' : 'Bulan'}
              </button>
            ))}
          </div>
          {mode === 'hari' && (
            <input type="date" value={nilai} onChange={e => setNilai(e.target.value)}
              className="mt-3 w-full rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
          )}
          {mode === 'minggu' && (
            <select value={nilai} onChange={e => setNilai(e.target.value)}
              className="mt-3 w-full appearance-none rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500">
              {mingguList.map(w => <option key={w.val} value={w.val}>{w.label}</option>)}
            </select>
          )}
          {mode === 'bulan' && (
            <select value={nilai} onChange={e => setNilai(e.target.value)}
              className="mt-3 w-full appearance-none rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500">
              {bulanList.map(b => <option key={b.val} value={b.val}>{b.label}</option>)}
            </select>
          )}
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow">
            <span className="grid size-9 place-items-center rounded-full bg-blue-50 text-blue-600">
              <CalendarDays className="size-4" />
            </span>
            <p className="mt-2 text-2xl font-extrabold">{data.total_sesi}</p>
            <p className="text-xs text-gray-500">Sesi Ngaji</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow">
            <span className="grid size-9 place-items-center rounded-full bg-blue-50 text-blue-600">
              <Users className="size-4" />
            </span>
            <p className="mt-2 text-2xl font-extrabold">{data.rekap_murid?.length || 0}</p>
            <p className="text-xs text-gray-500">Total Murid</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow">
            <span className="grid size-9 place-items-center rounded-full bg-blue-50 text-blue-600">
              <Wallet className="size-4" />
            </span>
            <p className="mt-2 truncate text-2xl font-extrabold">
              {(data.total_infaq || 0) >= 1000 ? `${Math.round((data.total_infaq || 0)/1000)}rb` : (data.total_infaq || 0)}
            </p>
            <p className="text-xs text-gray-500">Total Infaq</p>
          </div>
        </div>

        {/* Infaq summary */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow">
          <h2 className="text-sm font-extrabold">Ringkasan Infaq</h2>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <TrendingUp className="size-4 text-green-600" /> Infaq Masuk
              </span>
              <span className="text-sm font-extrabold text-green-600">Rp{formatRupiah(data.total_infaq)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <TrendingDown className="size-4 text-red-600" /> Pengeluaran
              </span>
              <span className="text-sm font-extrabold text-red-600">Rp{formatRupiah(data.total_pengeluaran)}</span>
            </div>
            <div className="border-t border-gray-200" />
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold">
                <Wallet className="size-4 text-blue-600" /> Sisa Infaq
              </span>
              <span className={`text-base font-extrabold ${(data.sisa_infaq || 0) < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                Rp{formatRupiah(data.sisa_infaq)}
              </span>
            </div>
          </div>
        </div>

        {/* Pengeluaran rincian */}
        {data.daftar_pengeluaran?.length > 0 && (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-red-50 text-red-600">
                  <MinusCircle className="size-4" />
                </span>
                <h2 className="text-sm font-extrabold">Rincian Pengeluaran</h2>
              </span>
              <span className="text-sm font-extrabold text-red-600">Rp{formatRupiah(data.total_pengeluaran)}</span>
            </div>
            <div className="mt-3.5 space-y-2.5">
              {data.daftar_pengeluaran.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.keterangan || '(tanpa keterangan)'}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(p.tanggal).toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-red-600">-Rp{formatRupiah(p.jumlah)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rekap global status */}
        {(() => {
          const totalHadir = data.rekap_murid?.reduce((s,m) => s+m.hadir, 0) || 0;
          const totalIzin  = data.rekap_murid?.reduce((s,m) => s+m.izin,  0) || 0;
          const totalSakit = data.rekap_murid?.reduce((s,m) => s+m.sakit, 0) || 0;
          const totalAlfa  = data.rekap_murid?.reduce((s,m) => s+m.alfa,  0) || 0;
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
            <div className="mb-6 rounded-2xl bg-white p-4 shadow">
              <h2 className="text-base font-bold">Rekapitulasi Global</h2>
              <div className="mt-3 space-y-3">
                {stats.map(s => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background:s.bg, color:s.color }}>
                          {s.label}
                        </span>
                        <span className="text-xs text-gray-500">{s.nilai} kali</span>
                      </span>
                      <span className="text-sm font-extrabold" style={{ color:s.color }}>{s.persen}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width:`${s.persen}%`, background:s.bar }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Jurnal & Infaq per sesi */}
        {data.daftar_sesi?.length > 0 && (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-blue-50 text-blue-600">
                  <NotebookPen className="size-4" />
                </span>
                <h2 className="text-sm font-extrabold">Jurnal &amp; Infaq</h2>
              </span>
              {data.total_infaq > 0 && (
                <span className="text-sm font-extrabold text-blue-600">Rp{data.total_infaq.toLocaleString('id-ID')}</span>
              )}
            </div>
            <div className="mt-3.5 space-y-3">
              {data.daftar_sesi.map(s => (
                <div key={s.tanggal} className="rounded-2xl bg-gray-50 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-500">
                      {new Date(s.tanggal).toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
                    </span>
                    {s.infaq > 0 && (
                      <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600">
                        Rp{s.infaq.toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                  {s.jurnal && (
                    <p className="mt-1.5 text-sm font-medium leading-relaxed">{s.jurnal}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rekap per murid */}
        {data.rekap_murid?.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-blue-50 text-blue-600">
              <ClipboardList className="size-7" />
            </div>
            <h3 className="mt-3 text-base font-extrabold">Belum ada data absensi</h3>
            <p className="mt-1 text-sm text-gray-500">Untuk periode ini belum ada absensi yang dicatat.</p>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-500">Detail Per Murid</p>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setDisplayMode('persen')}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    displayMode === 'persen'
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  % Hadir
                </button>
                <button
                  onClick={() => setDisplayMode('abjad')}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    displayMode === 'abjad'
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Abjad
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
            <div className="space-y-3">
              {[...data.rekap_murid]
                .sort((a,b) => displayMode === 'abjad'
                  ? a.nama.localeCompare(b.nama, 'id')
                  : b.persen_hadir - a.persen_hadir
                )
                .map((m, i) => {
                  const displayName = displayMode === 'sensor' ? sensorNama(m.nama, i) : m.nama;
                  return (
                    <div key={m.murid_id} className="rounded-2xl bg-gray-50 p-4">
                      <div className="flex items-center gap-3">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                          i < 3 ? 'bg-amber-400' : 'bg-blue-50 text-blue-600'
                        }`}>{i+1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{displayName}</span>
                        <span className="shrink-0 text-lg font-extrabold" style={{ color: getPersenColor(m.persen_hadir) }}>
                          {m.persen_hadir}%
                        </span>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
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
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500">Total: {m.total}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}