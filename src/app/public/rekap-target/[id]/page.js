'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Target, Users, ClipboardList, Trophy } from 'lucide-react';

function sensorNama(nama, index) {
  return `Murid ${index + 1}`;
}

function getPersenColor(persen) {
  if (persen === null) return '#9ca3af';
  if (persen >= 80) return '#16a34a';
  if (persen >= 60) return '#ca8a04';
  return '#dc2626';
}

export default function PublicRekapTargetPage() {
  const params = useParams();
  const kelompokId = params.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState('persen');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/rekap-target/${kelompokId}`);
        const json = await res.json();
        setData(res.ok ? json : null);
      } catch {
        setData(null);
      }
      setLoading(false);
    }
    fetchData();
  }, [kelompokId]);

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

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold">{data.kelompok_nama}</h1>
          <p className="text-sm text-gray-500">{data.desa} · {data.tingkatan}</p>
          <p className="mt-1 text-sm font-semibold text-blue-600">Rekap Target &amp; Capaian</p>
        </div>

        {/* Ringkasan capaian keseluruhan */}
        <div className="mb-6 rounded-2xl p-5 text-white shadow" style={{ background: 'linear-gradient(160deg,#155dfc 0%,#1447c9 100%)' }}>
          <h2 className="flex items-center gap-2 text-sm font-bold text-white/90">
            <Target className="size-4" /> Capaian Target Kelompok
          </h2>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-4xl font-extrabold">{data.persen_global}%</span>
            <span className="text-xs font-semibold text-white/85">
              {data.total_item} target per murid
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${data.persen_global}%` }} />
          </div>
        </div>

        {/* Ringkasan per kategori */}
        {data.per_kategori?.length > 0 && (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow">
            <h2 className="text-sm font-extrabold">Ringkasan per Kategori</h2>
            <div className="mt-3 space-y-3">
              {data.per_kategori.map(k => {
                const persen = k.total > 0 ? Math.round((k.tercapai / k.total) * 100) : 0;
                return (
                  <div key={k.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold">{k.label}</span>
                      <span className="font-extrabold" style={{ color: getPersenColor(persen) }}>
                        {k.total > 0 ? `${persen}%` : '–'}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${persen}%`, background: getPersenColor(persen) }} />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">Tercapai {k.tercapai} dari {k.total} slot</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rekap per murid */}
        {data.rekap_murid?.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-blue-50 text-blue-600">
              <ClipboardList className="size-7" />
            </div>
            <h3 className="mt-3 text-base font-extrabold">Belum ada murid</h3>
            <p className="mt-1 text-sm text-gray-500">Belum ada murid di kelompok ini.</p>
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
                  % Capaian
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
                  ? String(a.nama || '').localeCompare(String(b.nama || ''), 'id')
                  : (b.persen ?? -1) - (a.persen ?? -1)
                )
                .map((m, i) => {
                  const displayName = displayMode === 'sensor' ? sensorNama(m.nama, i) : m.nama;
                  return (
                    <div key={m.murid_id} className="rounded-2xl bg-gray-50 p-4">
                      <div className="flex items-center gap-3">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                          i < 3 ? 'bg-amber-400' : 'bg-blue-50 text-blue-600'
                        }`}>{i < 3 ? <Trophy className="size-4" /> : i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">{displayName}</span>
                        <span className="shrink-0 text-lg font-extrabold" style={{ color: getPersenColor(m.persen) }}>
                          {m.persen === null ? '–' : `${m.persen}%`}
                        </span>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full transition-all duration-500" style={{
                          width: `${m.persen ?? 0}%`,
                          background: m.persen >= 80
                            ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                            : m.persen >= 60
                            ? 'linear-gradient(90deg,#ca8a04,#eab308)'
                            : 'linear-gradient(90deg,#dc2626,#ef4444)',
                        }} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-gray-500">
                        Tercapai {m.tercapai} dari {m.total} target
                      </p>
                    </div>
                  );
                })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
              <Users className="size-3.5" /> {data.rekap_murid.length} murid · {data.total_item} target per murid
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
