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

export default function KelompokDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  const [kelompok, setKelompok] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (session) fetchData();
  }, [session]);

  async function fetchData() {
    const res = await fetch(`/api/kelompok/${kelompokId}`);
    if (!res.ok) { router.replace('/dashboard'); return; }
    setKelompok(await res.json());
    setLoading(false);
  }

  if (loading) return (
    <><Navbar /><div className="container page"><div className="spinner" /></div></>
  );

  const tk = TINGKATAN_LABEL[kelompok.tingkatan] || TINGKATAN_LABEL.kelompok;

  return (
    <>
      <Navbar />
      <div className="container page">
        <button className="btn btn-outline btn-sm" style={{ marginBottom:'1.25rem' }} onClick={() => router.push('/dashboard')}>
          ← Kembali
        </button>
        <div className="card" style={{ marginBottom:'1.5rem' }}>
          <h1 style={{ fontSize:'1.4rem', fontWeight:800, marginBottom:'.5rem' }}>
            {tk.icon} {kelompok.nama_kelompok}
          </h1>
          <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
            <span className={`badge ${tk.cls}`}>{tk.label}</span>
            <span className="badge" style={{ background:'#e0f2fe', color:'#0369a1' }}>📍 {kelompok.desa}</span>
            <span className="badge" style={{ background:'#f0fdf4', color:'#166534' }}>🗺 {kelompok.daerah}</span>
          </div>
          <div style={{ display:'flex', gap:'.5rem', marginTop:'1.25rem', flexWrap:'wrap' }}>
            <button className="btn btn-hijau" onClick={() => router.push(`/absensi/${kelompokId}`)}>✅ Absensi</button>
            <button className="btn btn-outline" onClick={() => router.push(`/rekap/${kelompokId}`)}>📊 Rekap</button>
            <button className="btn btn-outline" onClick={() => router.push(`/setup/${kelompokId}`)}>⚙️ Kelola</button>
          </div>
        </div>
        <div className="grid-2">
          <div className="card">
            <h3 style={{ fontWeight:700, marginBottom:'1rem' }}>👥 Murid ({kelompok.murid?.length || 0})</h3>
            {(kelompok.murid || []).map((m,i) => (
              <div key={m.id} style={{ padding:'.45rem 0', borderBottom:'1px solid var(--batas)', fontSize:'.9rem' }}>
                {i+1}. {m.nama_murid}
              </div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ fontWeight:700, marginBottom:'1rem' }}>📅 Jadwal Ngaji</h3>
            {(kelompok.jadwal || []).length === 0
              ? <p style={{ color:'var(--teks-soft)', fontSize:'.88rem' }}>Belum ada jadwal. <button className="btn btn-outline btn-sm" onClick={() => router.push(`/setup/${kelompokId}`)}>Set Jadwal</button></p>
              : (kelompok.jadwal || []).map(j => (
                  <div key={j.id} style={{ padding:'.45rem .75rem', background:'var(--hijau-pale)', borderRadius:'8px', marginBottom:'.4rem', fontWeight:600, fontSize:'.9rem', color:'var(--hijau)' }}>
                    📅 {j.hari}
                  </div>
                ))
            }
          </div>
        </div>
      </div>
    </>
  );
}
