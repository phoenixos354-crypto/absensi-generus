'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';

const HARI_LIST = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Ahad'];

const TINGKATAN_LABEL = {
  caberawit:  { label: 'Caberawit',     cls: 'tk-caberawit', icon: '🌱' },
  praremaja:  { label: 'Pra Remaja',    cls: 'tk-praremaja', icon: '🌿' },
  remaja:     { label: 'Remaja',        cls: 'tk-remaja',    icon: '🍃' },
  usianikah:  { label: 'Usia Nikah',    cls: 'tk-usianikah', icon: '🌸' },
  kelompok:   { label: 'Ngaji Kelompok',cls: 'tk-kelompok',  icon: '📖' },
};

export default function SetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  const [kelompok, setKelompok] = useState(null);
  const [murid, setMurid] = useState([]);
  const [jadwal, setJadwal] = useState([]);
  const [loading, setLoading] = useState(true);

  const [namaMurid, setNamaMurid] = useState('');
  const [bulkNama, setBulkNama] = useState('');
  const [modeBulk, setModeBulk] = useState(false);
  const [savingMurid, setSavingMurid] = useState(false);

  const [hariPilih, setHariPilih] = useState([]);
  const [savingJadwal, setSavingJadwal] = useState(false);
  const [jadwalSaved, setJadwalSaved] = useState(false);

  // State untuk edit murid
  const [editId, setEditId] = useState(null);
  const [editNama, setEditNama] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (session && kelompokId) fetchData();
  }, [session, kelompokId]);

  async function fetchData() {
    setLoading(true);
    const res = await fetch(`/api/kelompok/${kelompokId}`);
    if (!res.ok) { router.replace('/dashboard'); return; }
    const data = await res.json();
    // Hanya owner yang boleh akses halaman setup
    if (data.permission !== 'owner') {
      router.replace(`/dashboard`);
      return;
    }
    setKelompok(data);
    setMurid(data.murid || []);
    setJadwal(data.jadwal || []);
    setHariPilih((data.jadwal || []).map(j => j.hari));
    setLoading(false);
  }

  // Tambah murid satu per satu
  async function handleTambahMurid(e) {
    e.preventDefault();
    if (!namaMurid.trim()) return;
    setSavingMurid(true);
    const res = await fetch('/api/murid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, nama_murid: namaMurid.trim() }),
    });
    if (res.ok) {
      const baru = await res.json();
      setMurid(prev => [...prev, baru]);
      setNamaMurid('');
    }
    setSavingMurid(false);
  }

  // Tambah murid bulk (satu nama per baris)
  async function handleBulkMurid(e) {
    e.preventDefault();
    const names = bulkNama.split('\n').map(n => n.trim()).filter(Boolean);
    if (!names.length) return;
    setSavingMurid(true);
    for (const nama of names) {
      const res = await fetch('/api/murid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kelompok_id: kelompokId, nama_murid: nama }),
      });
      if (res.ok) {
        const baru = await res.json();
        setMurid(prev => [...prev, baru]);
      }
    }
    setBulkNama('');
    setModeBulk(false);
    setSavingMurid(false);
  }

  // Hapus murid
  async function handleHapusMurid(id) {
    if (!confirm('Yakin hapus murid ini?')) return;
    const res = await fetch(`/api/murid?id=${id}`, { method: 'DELETE' });
    if (res.ok) setMurid(prev => prev.filter(m => m.id !== id));
  }

  // Simpan edit nama murid
  async function handleSimpanEdit(id) {
    if (!editNama.trim()) return;
    setSavingEdit(true);
    const res = await fetch('/api/murid', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, nama_murid: editNama.trim() }),
    });
    if (res.ok) {
      setMurid(prev => prev.map(m => m.id === id ? { ...m, nama_murid: editNama.trim() } : m));
      setEditId(null);
      setEditNama('');
    }
    setSavingEdit(false);
  }

  // Simpan jadwal
  async function handleSimpanJadwal() {
    setSavingJadwal(true);
    const res = await fetch('/api/jadwal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, hari: hariPilih }),
    });
    if (res.ok) {
      setJadwalSaved(true);
      setTimeout(() => setJadwalSaved(false), 2500);
    }
    setSavingJadwal(false);
  }

  function toggleHari(h) {
    setHariPilih(prev =>
      prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]
    );
    setJadwalSaved(false);
  }

  if (loading || !kelompok) {
    return (
      <>
        <Navbar />
        <div className="container page"><div className="spinner" /></div>
      </>
    );
  }

  const tk = TINGKATAN_LABEL[kelompok.tingkatan] || TINGKATAN_LABEL.kelompok;

  return (
    <>
      <Navbar />
      <div className="container page">

        {/* Header */}
        <div style={{ marginBottom:'1.25rem' }}>
          <button className="btn btn-outline btn-sm" style={{ marginBottom:'.75rem' }} onClick={() => router.push('/dashboard')}>
            ← Kembali
          </button>
          <h1 className="page-title" style={{ marginBottom:'.4rem' }}>
            {tk.icon} {kelompok.nama_kelompok}
          </h1>
          <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
            <span className={`badge ${tk.cls}`}>{tk.label}</span>
            <span className="badge" style={{ background:'#e0f2fe', color:'#0369a1' }}>📍 {kelompok.desa}</span>
            <span className="badge" style={{ background:'#f0fdf4', color:'#166534' }}>🗺 {kelompok.daerah}</span>
          </div>
        </div>

        <div className="grid-2" style={{ alignItems:'start' }}>

          {/* === KIRI: JADWAL === */}
          <div className="card">
            <h2 style={{ fontWeight:700, fontSize:'1rem', marginBottom:'1rem', display:'flex', alignItems:'center', gap:'.5rem' }}>
              📅 Jadwal Ngaji Mingguan
            </h2>
            <p style={{ fontSize:'.85rem', color:'var(--teks-soft)', marginBottom:'1rem' }}>
              Pilih hari-hari pengajian berlangsung setiap minggunya:
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.5rem', marginBottom:'1.25rem' }}>
              {HARI_LIST.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleHari(h)}
                  style={{
                    padding:'.5rem 1rem',
                    borderRadius:'8px',
                    border: hariPilih.includes(h) ? '2px solid var(--hijau)' : '2px solid var(--batas)',
                    background: hariPilih.includes(h) ? 'var(--hijau)' : 'white',
                    color: hariPilih.includes(h) ? 'white' : 'var(--teks)',
                    fontWeight:600, fontSize:'.85rem', cursor:'pointer',
                    transition:'all .15s',
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
            {hariPilih.length > 0 && (
              <p style={{ fontSize:'.83rem', color:'var(--hijau)', marginBottom:'1rem', fontWeight:500 }}>
                ✅ Terpilih: {hariPilih.join(', ')}
              </p>
            )}
            <button
              className="btn btn-hijau btn-full"
              onClick={handleSimpanJadwal}
              disabled={savingJadwal || hariPilih.length === 0}
            >
              {savingJadwal ? 'Menyimpan...' : jadwalSaved ? '✅ Jadwal Tersimpan!' : '💾 Simpan Jadwal'}
            </button>
          </div>

          {/* === KANAN: MURID === */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <h2 style={{ fontWeight:700, fontSize:'1rem', display:'flex', alignItems:'center', gap:'.5rem' }}>
                👥 Daftar Murid
                <span className="badge" style={{ background:'var(--hijau-pale)', color:'var(--hijau)' }}>
                  {murid.length} orang
                </span>
              </h2>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setModeBulk(!modeBulk)}
              >
                {modeBulk ? '✏️ Satu per Satu' : '📋 Input Massal'}
              </button>
            </div>

            {/* Form tambah murid */}
            {!modeBulk ? (
              <form onSubmit={handleTambahMurid} style={{ display:'flex', gap:'.5rem', marginBottom:'1rem' }}>
                <input
                  className="input"
                  placeholder="Nama murid..."
                  value={namaMurid}
                  onChange={e => setNamaMurid(e.target.value)}
                  style={{ flex:1 }}
                />
                <button type="submit" className="btn btn-hijau" disabled={savingMurid}>
                  {savingMurid ? '...' : '＋'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleBulkMurid} style={{ marginBottom:'1rem' }}>
                <textarea
                  className="textarea"
                  rows={6}
                  placeholder="Satu nama per baris:&#10;Ahmad Fauzi&#10;Siti Nurhaliza&#10;Budi Santoso"
                  value={bulkNama}
                  onChange={e => setBulkNama(e.target.value)}
                  style={{ marginBottom:'.5rem' }}
                />
                <button type="submit" className="btn btn-hijau btn-full" disabled={savingMurid}>
                  {savingMurid ? 'Menyimpan...' : `＋ Tambah Semua`}
                </button>
              </form>
            )}

            {/* List murid */}
            <div style={{ maxHeight:'320px', overflowY:'auto' }}>
              {murid.length === 0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'var(--teks-soft)', fontSize:'.88rem' }}>
                  Belum ada murid. Tambahkan di atas.
                </div>
              ) : (
                murid.map((m, i) => (
                  <div key={m.id} style={{
                    display:'flex', alignItems:'center', gap:'.5rem',
                    padding:'.45rem .5rem',
                    borderRadius:'8px',
                    background: i % 2 === 0 ? 'var(--hijau-pale)' : 'transparent',
                    marginBottom:'.2rem',
                  }}>
                    <span style={{
                      width:'26px', height:'26px', flexShrink:0,
                      background:'var(--hijau)', color:'white',
                      borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'.75rem', fontWeight:700,
                    }}>{i+1}</span>

                    {/* Mode edit */}
                    {editId === m.id ? (
                      <>
                        <input
                          className="input"
                          style={{ flex:1, padding:'.3rem .6rem', fontSize:'.88rem' }}
                          value={editNama}
                          onChange={e => setEditNama(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSimpanEdit(m.id)}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSimpanEdit(m.id)}
                          disabled={savingEdit}
                          style={{ padding:'.3rem .6rem', background:'var(--hijau)', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'.8rem', fontWeight:600 }}
                        >
                          {savingEdit ? '...' : '✓'}
                        </button>
                        <button
                          onClick={() => { setEditId(null); setEditNama(''); }}
                          style={{ padding:'.3rem .6rem', background:'#f1f5f9', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'.8rem' }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex:1, fontSize:'.9rem', fontWeight:500 }}>{m.nama_murid}</span>
                        <button
                          onClick={() => { setEditId(m.id); setEditNama(m.nama_murid); }}
                          title="Edit"
                          style={{ padding:'.25rem .5rem', background:'#e0f2fe', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'.8rem' }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleHapusMurid(m.id)}
                          title="Hapus"
                          style={{ padding:'.25rem .5rem', background:'#fee2e2', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'.8rem' }}
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tombol lanjut ke absensi */}
        {murid.length > 0 && hariPilih.length > 0 && (
          <div style={{ marginTop:'1.5rem' }}>
            <div className="card card-emas" style={{ padding:'1.25rem' }}>
              <p style={{ marginBottom:'1rem', fontWeight:600 }}>
                ✅ Kelompok siap! {murid.length} murid · {hariPilih.length} hari/minggu
              </p>
              <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap' }}>
                <button className="btn btn-hijau btn-full" onClick={() => router.push(`/absensi/${kelompokId}`)}>
                  ✅ Mulai Absensi
                </button>
                <button className="btn btn-outline btn-full" onClick={() => router.push(`/rekap/${kelompokId}`)}>
                  📊 Lihat Rekap
                </button>
                <button className="btn btn-outline btn-full" onClick={() => router.push(`/admin/${kelompokId}`)}>
                  👥 Kelola Admin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
