'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';

const PERMISSION_INFO = {
  owner:  { label: 'Owner',         icon: '👑', desc: 'Akses penuh', cls: 'tk-usianikah' },
  absen:  { label: 'Pengabsen',     icon: '✅', desc: 'Hanya bisa absen', cls: 'tk-remaja' },
  viewer: { label: 'Lihat Laporan', icon: '👁️', desc: 'Hanya bisa lihat rekap', cls: 'tk-kelompok' },
};

export default function AdminKelompokPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  const [kelompok, setKelompok] = useState(null);
  const [adminList, setAdminList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myPermission, setMyPermission] = useState(null);

  const [emailBaru, setEmailBaru] = useState('');
  const [permissionBaru, setPermissionBaru] = useState('absen');
  const [inviting, setInviting] = useState(false);
  const [pesan, setPesan] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (session) fetchData();
  }, [session]);

  async function fetchData() {
    const [resK, resA] = await Promise.all([
      fetch(`/api/kelompok/${kelompokId}`),
      fetch(`/api/admin-kelompok?kelompok_id=${kelompokId}`),
    ]);
    if (!resK.ok) { router.replace('/dashboard'); return; }
    const k = await resK.json();
    const a = await resA.json();
    setKelompok(k);
    setAdminList(Array.isArray(a) ? a : []);
    const me = a.find(x => x.email === session.user.email);
    setMyPermission(me?.permission || null);
    setLoading(false);
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!emailBaru.trim()) return;
    setInviting(true);
    setPesan(null);
    const res = await fetch('/api/admin-kelompok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, email: emailBaru.trim(), permission: permissionBaru }),
    });
    const data = await res.json();
    if (res.ok) {
      setAdminList(prev => [...prev, data]);
      setEmailBaru('');
      setPesan({ type: 'ok', text: `✅ ${emailBaru} berhasil ditambahkan sebagai ${PERMISSION_INFO[permissionBaru].label}` });
    } else {
      setPesan({ type: 'err', text: `❌ ${data.error}` });
    }
    setInviting(false);
  }

  async function handleHapus(adminId) {
    if (!confirm('Hapus admin ini?')) return;
    const res = await fetch(`/api/admin-kelompok?id=${adminId}&kelompok_id=${kelompokId}`, { method: 'DELETE' });
    if (res.ok) setAdminList(prev => prev.filter(a => a.id !== adminId));
  }

  if (loading) return (
    <><Navbar /><div className="container page"><div className="spinner" /></div></>
  );

  const isOwner = myPermission === 'owner';

  return (
    <>
      <Navbar />
      <div className="container page" style={{ paddingBottom:'2rem' }}>
        {/* Header */}
        <div style={{ marginBottom:'1.25rem' }}>
          <button className="btn btn-outline btn-sm" style={{ marginBottom:'.75rem' }}
            onClick={() => router.push(`/setup/${kelompokId}`)}>← Kembali</button>
          <h1 className="page-title" style={{ marginBottom:'.3rem' }}>👥 Kelola Admin</h1>
          <p className="page-sub">{kelompok?.nama_kelompok}</p>
        </div>

        {/* Info permission */}
        <div className="card card-emas" style={{ marginBottom:'1.25rem' }}>
          <p style={{ fontSize:'.85rem', fontWeight:600, marginBottom:'.6rem', color:'var(--teks)' }}>
            💡 Penjelasan Permission:
          </p>
          {Object.entries(PERMISSION_INFO).map(([key, val]) => (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'.4rem' }}>
              <span className={`badge ${val.cls}`}>{val.icon} {val.label}</span>
              <span style={{ fontSize:'.82rem', color:'var(--teks-soft)' }}>— {val.desc}</span>
            </div>
          ))}
        </div>

        {/* Form invite — hanya owner */}
        {isOwner && (
          <div className="card" style={{ marginBottom:'1.25rem' }}>
            <h2 style={{ fontWeight:700, fontSize:'.95rem', marginBottom:'1rem' }}>➕ Tambah Admin</h2>
            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label className="label">Email Google Admin Baru</label>
                <input
                  className="input"
                  type="email"
                  placeholder="contoh@gmail.com"
                  value={emailBaru}
                  onChange={e => setEmailBaru(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Permission</label>
                <select className="select" value={permissionBaru} onChange={e => setPermissionBaru(e.target.value)}>
                  <option value="absen">✅ Pengabsen — hanya bisa absen</option>
                  <option value="viewer">👁️ Lihat Laporan — hanya lihat rekap</option>
                  <option value="owner">👑 Owner — akses penuh</option>
                </select>
              </div>
              {pesan && (
                <div style={{
                  padding:'.75rem', borderRadius:'8px', marginBottom:'.75rem', fontSize:'.85rem', fontWeight:600,
                  background: pesan.type === 'ok' ? '#dcfce7' : '#fee2e2',
                  color: pesan.type === 'ok' ? '#166534' : '#dc2626',
                }}>
                  {pesan.text}
                </div>
              )}
              <button type="submit" className="btn btn-hijau btn-full" disabled={inviting}>
                {inviting ? 'Menambahkan...' : '➕ Tambah Admin'}
              </button>
            </form>
          </div>
        )}

        {/* Daftar admin */}
        <div className="card">
          <h2 style={{ fontWeight:700, fontSize:'.95rem', marginBottom:'1rem' }}>
            📋 Daftar Admin ({adminList.length})
          </h2>
          {adminList.length === 0 ? (
            <p style={{ color:'var(--teks-soft)', fontSize:'.88rem' }}>Belum ada admin lain.</p>
          ) : (
            adminList.map(a => {
              const pInfo = PERMISSION_INFO[a.permission] || PERMISSION_INFO.viewer;
              const isMe = a.email === session?.user?.email;
              return (
                <div key={a.id} style={{
                  display:'flex', alignItems:'center', gap:'.65rem',
                  padding:'.75rem 0',
                  borderBottom:'1px solid var(--batas)',
                }}>
                  <div style={{
                    width:'36px', height:'36px', borderRadius:'50%',
                    background:'var(--hijau-pale)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'1.1rem', flexShrink:0,
                  }}>
                    {pInfo.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:'.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {a.email} {isMe && <span style={{ color:'var(--hijau)', fontSize:'.75rem' }}>(Saya)</span>}
                    </div>
                    <span className={`badge ${pInfo.cls}`} style={{ marginTop:'.25rem', display:'inline-block' }}>
                      {pInfo.label}
                    </span>
                  </div>
                  {/* Tombol hapus — owner bisa hapus siapa saja kecuali diri sendiri */}
                  {isOwner && !isMe && (
                    <button
                      onClick={() => handleHapus(a.id)}
                      style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:'8px', padding:'.4rem .7rem', cursor:'pointer', fontSize:'.82rem', fontWeight:700, flexShrink:0 }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
