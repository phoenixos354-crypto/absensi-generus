'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';

const STATUS_LIST = ['Hadir','Izin','Sakit','Alfa'];

const STATUS_COLOR = {
  Hadir: { border:'#22c55e', bg:'#22c55e', text:'white', pale:'#dcfce7', paleText:'#166534' },
  Izin:  { border:'#eab308', bg:'#eab308', text:'white', pale:'#fef9c3', paleText:'#854d0e' },
  Sakit: { border:'#3b82f6', bg:'#3b82f6', text:'white', pale:'#dbeafe', paleText:'#1e40af' },
  Alfa:  { border:'#ef4444', bg:'#ef4444', text:'white', pale:'#fee2e2', paleText:'#991b1b' },
};

const TINGKATAN_LABEL = {
  caberawit:  { label: 'Caberawit',     cls: 'tk-caberawit', icon: '🌱' },
  praremaja:  { label: 'Pra Remaja',    cls: 'tk-praremaja', icon: '🌿' },
  remaja:     { label: 'Remaja',        cls: 'tk-remaja',    icon: '🍃' },
  usianikah:  { label: 'Usia Nikah',    cls: 'tk-usianikah', icon: '🌸' },
  kelompok:   { label: 'Ngaji Kelompok',cls: 'tk-kelompok',  icon: '📖' },
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingLoaded, setExistingLoaded] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (session && kelompokId) fetchKelompok();
  }, [session, kelompokId]);

  useEffect(() => {
    if (murid.length > 0) loadAbsensiTanggal();
  }, [tanggal, murid]);

  async function fetchKelompok() {
    const res = await fetch(`/api/kelompok/${kelompokId}`);
    if (!res.ok) { router.replace('/dashboard'); return; }
    const data = await res.json();
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
    const res = await fetch('/api/absensi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, tanggal, absensi: absensiArr }),
    });
    if (res.ok) {
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

  if (loading || !kelompok) return (
    <><Navbar /><div className="container page"><div className="spinner" /></div></>
  );

  const tk = TINGKATAN_LABEL[kelompok.tingkatan] || TINGKATAN_LABEL.kelompok;

  return (
    <>
      <Navbar />
      <div className="container page">
        {/* Header */}
        <div style={{ marginBottom:'1.25rem' }}>
          <h1 className="page-title" style={{ marginBottom:'.4rem' }}>
            ✅ {kelompok.nama_kelompok}
          </h1>
          <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
            <span className={`badge ${tk.cls}`}>{tk.icon} {tk.label}</span>
            <span className="badge" style={{ background:'#e0f2fe', color:'#0369a1' }}>📍 {kelompok.desa}</span>
          </div>
        </div>

        {/* Pilih tanggal + summary */}
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          {/* Tanggal */}
          <div className="form-group" style={{ marginBottom:'.75rem' }}>
            <label className="label">📅 Tanggal Absensi</label>
            <input
              type="date"
              className="input"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
            />
          </div>
          {/* Set semua */}
          <div style={{ marginBottom:'.75rem' }}>
            <div style={{ fontSize:'.8rem', color:'var(--teks-soft)', fontWeight:600, marginBottom:'.4rem' }}>Set semua murid:</div>
            <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
              {STATUS_LIST.map(s => {
                const c = STATUS_COLOR[s];
                return (
                  <button
                    key={s}
                    onClick={() => setAllStatus(s)}
                    style={{
                      padding:'.35rem .75rem',
                      border:`1.5px solid ${c.border}`,
                      borderRadius:'7px',
                      background:'white',
                      color: c.paleText,
                      fontSize:'.78rem', fontWeight:700, cursor:'pointer',
                      minHeight:'34px',
                    }}
                  >
                    {s} Semua
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress bar kehadiran */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.35rem' }}>
              <span style={{ fontSize:'.82rem', fontWeight:600, color:'var(--teks-soft)' }}>Kehadiran hari ini</span>
              <span style={{ fontSize:'.88rem', fontWeight:800, color:'var(--hijau)' }}>{persen}%</span>
            </div>
            <div className="progress-wrap" style={{ marginBottom:'.65rem' }}>
              <div className="progress-bar" style={{ width:`${persen}%` }} />
            </div>
            <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
              {STATUS_LIST.map(s => {
                const c = STATUS_COLOR[s];
                return (
                  <div key={s} style={{
                    background: c.pale, color: c.paleText,
                    padding:'.28rem .6rem', borderRadius:'7px',
                    fontSize:'.78rem', fontWeight:700,
                  }}>
                    {s}: {summary[s]}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabel absensi */}
        {murid.length === 0 ? (
          <div className="empty-state card">
            <div className="icon">👥</div>
            <h3>Belum ada murid</h3>
            <p style={{ marginBottom:'1rem' }}>Tambahkan murid terlebih dahulu</p>
            <button className="btn btn-hijau" onClick={() => router.push(`/setup/${kelompokId}`)}>
              ⚙️ Setup Murid
            </button>
          </div>
        ) : (
          <div>
            {murid.map((m, i) => {
              const currentStatus = absensiMap[m.id] || 'Hadir';
              return (
                <div key={m.id} className="abs-card">
                  <div className="abs-card-nomor">{i+1}</div>
                  <div className="abs-card-nama">{m.nama_murid}</div>
                  <div className="abs-status-group">
                    {STATUS_LIST.map(s => (
                      <button
                        key={s}
                        onClick={() => setStatus(m.id, s)}
                        className={`abs-status-btn ${s.toLowerCase()}${currentStatus === s ? ' aktif' : ''}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom bar sticky */}
        {murid.length > 0 && (
          <div className="bottom-bar">
            <button className="btn btn-outline" onClick={() => router.push('/dashboard')}>← Kembali</button>
            <button
              className={`btn ${saved ? 'btn-outline' : 'btn-hijau'}`}
              onClick={() => setShowKonfirmasi(true)}
              disabled={saving}
            >
              {saving ? '⏳ Menyimpan...' : saved ? '✅ Tersimpan!' : '💾 Simpan Absensi'}
            </button>
          </div>
        )}

        {/* Modal konfirmasi simpan */}
        {showKonfirmasi && (
          <div className="modal-overlay" onClick={() => setShowKonfirmasi(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div style={{ padding:'1.5rem', textAlign:'center' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>📋</div>
                <h3 style={{ fontWeight:800, fontSize:'1.1rem', marginBottom:'.5rem' }}>Konfirmasi Absensi</h3>
                <p style={{ color:'var(--teks-soft)', fontSize:'.88rem', marginBottom:'1rem' }}>
                  {new Date(tanggal).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                </p>
                <div style={{ display:'flex', justifyContent:'center', gap:'.5rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
                  {STATUS_LIST.map(s => (
                    <div key={s} style={{ textAlign:'center', padding:'.5rem .85rem', borderRadius:'8px',
                      background: s==='Hadir'?'#dcfce7':s==='Izin'?'#fef9c3':s==='Sakit'?'#dbeafe':'#fee2e2',
                      color: s==='Hadir'?'#166534':s==='Izin'?'#854d0e':s==='Sakit'?'#1e40af':'#991b1b',
                    }}>
                      <div style={{ fontWeight:800, fontSize:'1.2rem' }}>{summary[s]}</div>
                      <div style={{ fontSize:'.75rem', fontWeight:600 }}>{s}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize:'.82rem', color:'var(--teks-soft)', marginBottom:'1.25rem' }}>
                  Total {murid.length} murid · Kehadiran <strong style={{ color:'var(--hijau)' }}>{persen}%</strong>
                </p>
                <div style={{ display:'flex', gap:'.75rem' }}>
                  <button className="btn btn-outline btn-full" onClick={() => setShowKonfirmasi(false)}>Cek Lagi</button>
                  <button className="btn btn-hijau btn-full" onClick={() => { setShowKonfirmasi(false); handleSimpan(); }}>
                    ✅ Simpan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
