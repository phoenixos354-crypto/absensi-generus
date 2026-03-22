'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';

const TINGKATAN_LABEL = {
  caberawit:  { label: 'Caberawit',     cls: 'tk-caberawit', icon: '🌱' },
  praremaja:  { label: 'Pra Remaja',    cls: 'tk-praremaja', icon: '🌿' },
  remaja:     { label: 'Remaja',        cls: 'tk-remaja',    icon: '🍃' },
  usianikah:  { label: 'Usia Nikah',    cls: 'tk-usianikah', icon: '🌸' },
  kelompok:   { label: 'Ngaji Kelompok',cls: 'tk-kelompok',  icon: '📖' },
};

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

  const [kelompok, setKelompok] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rekap, setRekap] = useState(null);
  const [loadingRekap, setLoadingRekap] = useState(false);

  const [mode, setMode] = useState('bulan');
  const [nilai, setNilai] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });

  const bulanList  = getBulanList();
  const mingguList = getMingguList();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (session) fetchKelompok();
  }, [session]);

  useEffect(() => {
    if (kelompok) fetchRekap();
  }, [kelompok, mode, nilai]);

  async function fetchKelompok() {
    const res = await fetch(`/api/kelompok/${kelompokId}`);
    if (!res.ok) { router.replace('/dashboard'); return; }
    setKelompok(await res.json());
    setLoading(false);
  }

  async function fetchRekap() {
    setLoadingRekap(true);
    const res = await fetch(`/api/rekap?kelompok_id=${kelompokId}&mode=${mode}&nilai=${nilai}`);
    setRekap(await res.json());
    setLoadingRekap(false);
  }

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

  if (loading) return (
    <><Navbar /><div className="container page"><div className="spinner" /></div></>
  );

  const tk = TINGKATAN_LABEL[kelompok?.tingkatan] || TINGKATAN_LABEL.kelompok;

  return (
    <>
      <Navbar />
      <div className="container page">
        {/* Header */}
        <div style={{ marginBottom:'1.25rem' }}>
          <h1 className="page-title" style={{ marginBottom:'.4rem' }}>
            📊 {kelompok?.nama_kelompok}
          </h1>
          <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
            <span className={`badge ${tk.cls}`}>{tk.icon} {tk.label}</span>
            <span className="badge" style={{ background:'#e0f2fe', color:'#0369a1' }}>📍 {kelompok?.desa}</span>
          </div>
        </div>

        {/* Filter periode */}
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <div style={{ display:'flex', gap:'.5rem', marginBottom:'.75rem' }}>
            {['hari','minggu','bulan'].map(m => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`btn btn-sm ${mode === m ? 'btn-hijau' : 'btn-outline'}`}
                style={{ flex:1 }}
              >
                {m === 'hari' ? '📅 Hari' : m === 'minggu' ? '📆 Minggu' : '🗓 Bulan'}
              </button>
            ))}
          </div>
          {mode === 'hari' && (
            <input type="date" className="input" value={nilai} onChange={e => setNilai(e.target.value)} />
          )}
          {mode === 'minggu' && (
            <select className="select" value={nilai} onChange={e => setNilai(e.target.value)}>
              {mingguList.map(w => <option key={w.val} value={w.val}>{w.label}</option>)}
            </select>
          )}
          {mode === 'bulan' && (
            <select className="select" value={nilai} onChange={e => setNilai(e.target.value)}>
              {bulanList.map(b => <option key={b.val} value={b.val}>{b.label}</option>)}
            </select>
          )}
        </div>

        {loadingRekap ? (
          <div className="spinner" />
        ) : rekap ? (
          <>
            {/* Ringkasan global */}
            <div className="grid-3" style={{ marginBottom:'1.5rem' }}>
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div>
                  <div className="stat-value">{rekap.total_sesi}</div>
                  <div className="stat-label">Sesi Ngaji</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div>
                  <div className="stat-value">{rekap.rekap_murid?.length || 0}</div>
                  <div className="stat-label">Total Murid</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: rekap.persen_global >= 80 ? '#dcfce7' : rekap.persen_global >= 60 ? '#fef9c3' : '#fee2e2' }}>
                  📈
                </div>
                <div>
                  <div className="stat-value" style={{ color: getPersenColor(rekap.persen_global) }}>
                    {rekap.persen_global}%
                  </div>
                  <div className="stat-label">Kehadiran Global</div>
                </div>
              </div>
            </div>

            {/* Progress global */}
            <div className="card" style={{ marginBottom:'1.5rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.5rem' }}>
                <span style={{ fontWeight:700 }}>Rata-rata Kehadiran</span>
                <span style={{ fontWeight:800, color: getPersenColor(rekap.persen_global) }}>
                  {rekap.persen_global}%
                </span>
              </div>
              <div className="progress-wrap" style={{ height:'14px' }}>
                <div
                  className="progress-bar"
                  style={{
                    width:`${rekap.persen_global}%`,
                    background: rekap.persen_global >= 80
                      ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                      : rekap.persen_global >= 60
                      ? 'linear-gradient(90deg,#ca8a04,#eab308)'
                      : 'linear-gradient(90deg,#dc2626,#ef4444)',
                  }}
                />
              </div>
              {rekap.tanggal_sesi?.length > 0 && (
                <p style={{ fontSize:'.8rem', color:'var(--teks-soft)', marginTop:'.75rem' }}>
                  Sesi tercatat: {rekap.tanggal_sesi.map(t => new Date(t).toLocaleDateString('id-ID',{day:'numeric',month:'short'})).join(' · ')}
                </p>
              )}
            </div>

            {/* Rekap per murid — card style mobile */}
            {rekap.rekap_murid?.length === 0 ? (
              <div className="empty-state card">
                <div className="icon">📭</div>
                <h3>Belum ada data absensi</h3>
                <p style={{ marginBottom:'1rem' }}>Untuk periode ini belum ada absensi yang dicatat.</p>
                <button className="btn btn-hijau" onClick={() => router.push(`/absensi/${kelompokId}`)}>
                  ✅ Catat Absensi Sekarang
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:'.75rem', color:'var(--teks-soft)' }}>
                  📋 Detail Per Murid — diurutkan dari kehadiran tertinggi
                </div>
                {[...rekap.rekap_murid]
                  .sort((a,b) => b.persen_hadir - a.persen_hadir)
                  .map((m, i) => (
                  <div key={m.murid_id} className="card" style={{ marginBottom:'.65rem', padding:'1rem' }}>
                    {/* Baris atas: nomor + nama + persen */}
                    <div style={{ display:'flex', alignItems:'center', gap:'.65rem', marginBottom:'.65rem' }}>
                      <span style={{
                        width:'28px', height:'28px', flexShrink:0,
                        background: i < 3 ? 'var(--emas)' : 'var(--hijau)',
                        color:'white', borderRadius:'50%',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'.75rem', fontWeight:800,
                      }}>{i+1}</span>
                      <span style={{ flex:1, fontWeight:700, fontSize:'.95rem' }}>{m.nama}</span>
                      <span style={{
                        fontWeight:800, fontSize:'1.05rem',
                        color: getPersenColor(m.persen_hadir),
                      }}>{m.persen_hadir}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="progress-wrap" style={{ marginBottom:'.65rem' }}>
                      <div className="progress-bar" style={{
                        width:`${m.persen_hadir}%`,
                        background: m.persen_hadir >= 80
                          ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                          : m.persen_hadir >= 60
                          ? 'linear-gradient(90deg,#ca8a04,#eab308)'
                          : 'linear-gradient(90deg,#dc2626,#ef4444)',
                      }} />
                    </div>

                    {/* Badge status */}
                    <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                      <span className="badge badge-hadir">✅ Hadir: {m.hadir}</span>
                      <span className="badge badge-izin">📋 Izin: {m.izin}</span>
                      <span className="badge badge-sakit">🤒 Sakit: {m.sakit}</span>
                      <span className="badge badge-alfa">❌ Alfa: {m.alfa}</span>
                      <span className="badge" style={{ background:'#f1f5f9', color:'#475569' }}>
                        Total: {m.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {/* Bottom bar */}
        <div className="bottom-bar">
          <button className="btn btn-outline" onClick={() => router.push('/dashboard')}>← Dashboard</button>
          <button className="btn btn-hijau" onClick={() => router.push(`/absensi/${kelompokId}`)}>✅ Absensi</button>
        </div>
      </div>
    </>
  );
}
