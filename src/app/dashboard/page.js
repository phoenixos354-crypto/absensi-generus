'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';

const TINGKATAN_LABEL = {
  caberawit:  { label: 'Caberawit',     cls: 'tk-caberawit', icon: '🌱' },
  praremaja:  { label: 'Pra Remaja',    cls: 'tk-praremaja', icon: '🌿' },
  remaja:     { label: 'Remaja',        cls: 'tk-remaja',    icon: '🍃' },
  usianikah:  { label: 'Usia Nikah',    cls: 'tk-usianikah', icon: '🌸' },
  kelompok:   { label: 'Ngaji Kelompok',cls: 'tk-kelompok',  icon: '📖' },
};

const FORM_KOSONG = { nama_kelompok:'', tingkatan:'caberawit', desa:'', daerah:'' };

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [kelompok, setKelompok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [saving, setSaving] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);
  const [hapusing, setHapusing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (session) init();
  }, [session]);

  async function init() {
    try { await fetch('/api/init', { method: 'POST' }); } catch (e) {}
    await fetchKelompok();
    const seen = localStorage.getItem('onboarding_done');
    if (!seen) setShowOnboarding(true);
  }

  async function fetchKelompok() {
    setLoading(true);
    const res = await fetch('/api/kelompok');
    const data = await res.json();
    setKelompok(Array.isArray(data) ? data : []);
    setLoading(false);
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
      setKelompok(prev => prev.map(k => k.id === editTarget.id ? { ...k, ...form } : k));
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
    setKelompok(prev => prev.filter(k => k.id !== hapusTarget.id));
    setHapusTarget(null);
    setHapusing(false);
  }

  function selesaiOnboarding() {
    localStorage.setItem('onboarding_done', '1');
    setShowOnboarding(false);
  }

  const hariIni = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' });

  const ONBOARD_STEPS = [
    { icon:'🕌', judul:'Selamat Datang!', isi:'Absensi Generus membantu Anda mencatat kehadiran murid pengajian dengan mudah langsung dari HP.' },
    { icon:'➕', judul:'Buat Kelompok', isi:'Mulai dengan membuat kelompok pengajian. Isi nama kelompok, tingkatan, desa, dan daerah.' },
    { icon:'👥', judul:'Tambah Murid', isi:'Setelah buat kelompok, tambahkan nama-nama murid dan tentukan jadwal ngaji mingguan.' },
    { icon:'✅', judul:'Mulai Absensi', isi:'Tiap hari ngaji, buka kelompok → tap Absen → tandai Hadir/Izin/Sakit/Alfa → Simpan. Selesai!' },
    { icon:'📊', judul:'Lihat Rekap', isi:'Pantau persentase kehadiran per murid, per hari, minggu, atau bulan kapan saja.' },
  ];

  if (status === 'loading' || loading) return (
    <><Navbar /><div className="container page"><div className="spinner" /></div></>
  );

  return (
    <>
      <Navbar />
      <div className="container page">
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'.75rem' }}>
            <div>
              <h1 className="page-title">📋 Kelompok Saya</h1>
              <p className="page-sub">{hariIni} · {session?.user?.name?.split(' ')[0]}</p>
            </div>
            <button style={{ background:'rgba(26,107,60,.08)', color:'var(--hijau)', border:'none', borderRadius:'8px', padding:'.5rem .85rem', fontSize:'.82rem', fontWeight:600, cursor:'pointer' }}
              onClick={() => { setShowOnboarding(true); setOnboardStep(0); }}>❓ Panduan</button>
          </div>
        </div>

        <div className="grid-3" style={{ marginBottom:'1.25rem' }}>
          <div className="stat-card">
            <div className="stat-icon">📚</div>
            <div><div className="stat-value">{kelompok.length}</div><div className="stat-label">Kelompok</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background:'#fef9c3' }}>📅</div>
            <div><div className="stat-value">{new Date().getDate()}</div><div className="stat-label">{new Date().toLocaleDateString('id-ID',{month:'short',year:'numeric'})}</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background:'#ede9fe' }}>🌙</div>
            <div><div className="stat-value">{new Date().toLocaleDateString('id-ID',{weekday:'short'})}</div><div className="stat-label">Hari ini</div></div>
          </div>
        </div>

        {kelompok.length === 0 ? (
          <div className="empty-state card">
            <div className="icon">🕌</div>
            <h3>Belum ada kelompok</h3>
            <p style={{ fontSize:'.88rem', marginBottom:'1.25rem' }}>Mulai dengan membuat kelompok pengajian pertama Anda</p>
            <button className="btn btn-hijau" onClick={bukaModalBaru}>＋ Buat Kelompok Pertama</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'.75rem', marginBottom:'5rem' }}>
            {kelompok.map(k => {
              const tk = TINGKATAN_LABEL[k.tingkatan] || TINGKATAN_LABEL.kelompok;
              return (
                <div key={k.id} className="kelompok-card" onClick={() => router.push(`/absensi/${k.id}`)}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'.5rem', marginBottom:'.5rem' }}>
                    <span className="kelompok-nama">{tk.icon} {k.nama_kelompok}</span>
                    <span className={`badge ${tk.cls}`} style={{ flexShrink:0 }}>{tk.label}</span>
                  </div>
                  <div className="kelompok-meta" style={{ marginBottom:'.85rem' }}>
                    <span>📍 {k.desa}</span><span>🗺 {k.daerah}</span>
                  </div>
                  <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                    <button className="btn btn-hijau btn-sm" onClick={e => { e.stopPropagation(); router.push(`/absensi/${k.id}`); }}>✅ Absen</button>
                    <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); router.push(`/rekap/${k.id}`); }}>📊 Rekap</button>
                    <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); router.push(`/setup/${k.id}`); }}>⚙️ Kelola</button>
                    <button className="btn btn-sm" style={{ background:'#e0f2fe', color:'#0369a1', border:'none' }} onClick={e => bukaModalEdit(k, e)}>✏️</button>
                    <button className="btn btn-sm" style={{ background:'#fee2e2', color:'#dc2626', border:'none' }} onClick={e => { e.stopPropagation(); setHapusTarget(k); }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bottom-bar">
        <button className="btn btn-hijau" onClick={bukaModalBaru}>＋ Kelompok Baru</button>
      </div>

      {/* Modal Buat/Edit */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-header">
              <span className="modal-title">{editTarget ? '✏️ Edit Kelompok' : '🕌 Kelompok Baru'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSimpan}>
                <div className="form-group">
                  <label className="label">Nama Kelompok</label>
                  <input className="input" placeholder="cth: Kelompok Masjid Al-Ikhlas" value={form.nama_kelompok} onChange={e => setForm({...form, nama_kelompok: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="label">Tingkatan Ngaji</label>
                  <select className="select" value={form.tingkatan} onChange={e => setForm({...form, tingkatan: e.target.value})}>
                    <option value="caberawit">🌱 Caberawit</option>
                    <option value="praremaja">🌿 Pra Remaja</option>
                    <option value="remaja font">🍃 Remaja</option>
                    <option value="usianikah">🌸 Usia Nikah</option>
                    <option value="kelompok">📖 Ngaji Kelompok</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Desa</label>
                  <input className="input" placeholder="cth: Ds. Sukamaju" value={form.desa} onChange={e => setForm({...form, desa: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="label">Daerah</label>
                  <input className="input" placeholder="cth: Daerah Kediri" value={form.daerah} onChange={e => setForm({...form, daerah: e.target.value})} required />
                </div>
                <button type="submit" className="btn btn-hijau btn-full" disabled={saving}>
                  {saving ? 'Menyimpan...' : editTarget ? '💾 Simpan Perubahan' : 'Simpan & Setup →'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus */}
      {hapusTarget && (
        <div className="modal-overlay" onClick={() => setHapusTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-body" style={{ textAlign:'center', padding:'2rem 1.5rem' }}>
              <div style={{ fontSize:'3rem', marginBottom:'.75rem' }}>⚠️</div>
              <h3 style={{ fontWeight:800, fontSize:'1.1rem', marginBottom:'.5rem' }}>Hapus Kelompok?</h3>
              <p style={{ color:'var(--teks-soft)', marginBottom:'.75rem' }}><strong>{hapusTarget.nama_kelompok}</strong></p>
              <p style={{ color:'#dc2626', fontSize:'.85rem', background:'#fee2e2', padding:'.75rem', borderRadius:'8px', marginBottom:'1.5rem' }}>
                Semua data murid, jadwal, dan absensi akan ikut terhapus permanen!
              </p>
              <div style={{ display:'flex', gap:'.75rem' }}>
                <button className="btn btn-outline btn-full" onClick={() => setHapusTarget(null)}>Batal</button>
                <button className="btn btn-full" style={{ background:'#dc2626', color:'white', border:'none' }} onClick={handleHapus} disabled={hapusing}>
                  {hapusing ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding */}
      {showOnboarding && (
        <div className="modal-overlay" onClick={selesaiOnboarding}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ padding:'1.5rem 1.5rem 2rem', textAlign:'center' }}>
              <div style={{ display:'flex', justifyContent:'center', gap:'.4rem', marginBottom:'1.5rem' }}>
                {ONBOARD_STEPS.map((_, i) => (
                  <div key={i} style={{ width: i===onboardStep?'24px':'8px', height:'8px', borderRadius:'99px', background: i===onboardStep?'var(--hijau)':'var(--batas)', transition:'all .3s' }} />
                ))}
              </div>
              <div style={{ fontSize:'4rem', marginBottom:'1rem' }}>{ONBOARD_STEPS[onboardStep].icon}</div>
              <h2 style={{ fontWeight:800, fontSize:'1.25rem', marginBottom:'.75rem' }}>{ONBOARD_STEPS[onboardStep].judul}</h2>
              <p style={{ color:'var(--teks-soft)', lineHeight:'1.7', fontSize:'.95rem', marginBottom:'2rem' }}>{ONBOARD_STEPS[onboardStep].isi}</p>
              <div style={{ display:'flex', gap:'.75rem' }}>
                {onboardStep > 0 && <button className="btn btn-outline" style={{ flex:1 }} onClick={() => setOnboardStep(s=>s-1)}>← Kembali</button>}
                {onboardStep < ONBOARD_STEPS.length-1
                  ? <button className="btn btn-hijau" style={{ flex:1 }} onClick={() => setOnboardStep(s=>s+1)}>Lanjut →</button>
                  : <button className="btn btn-hijau" style={{ flex:1 }} onClick={selesaiOnboarding}>✅ Mulai!</button>
                }
              </div>
              <button onClick={selesaiOnboarding} style={{ marginTop:'1rem', background:'none', border:'none', color:'var(--teks-soft)', fontSize:'.82rem', cursor:'pointer' }}>Lewati</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
