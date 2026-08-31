'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppScreen } from '@/components/AppScreen';
import { TingkatanIcon, getTingkatan } from '@/components/tingkatan';
import { ChevronLeft, CalendarDays, Users, Pencil, Trash2, Check, X, Plus, ListChecks, BarChart3, UserCog, MapPin, Map } from 'lucide-react';

const HARI_LIST = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Ahad'];

export default function SetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  const [kelompok, setKelompok] = useState(null);
  const [murid, setMurid] = useState([]);
  const [jadwal, setJadwal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gagalMuat, setGagalMuat] = useState(false);

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
    setGagalMuat(false);

    // Coba beberapa kali dulu sebelum menyerah — kalau gagalnya cuma
    // gangguan sesaat (server lagi rame), jangan langsung dilempar ke
    // dashboard, biar tidak terasa "masuk lalu keluar sendiri".
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

  if (gagalMuat) {
    return (
      <AppScreen>
        <div className="px-5 pt-16 text-center">
          <p className="text-sm font-semibold text-ink">Gagal memuat data kelompok</p>
          <p className="mt-1 text-xs text-muted-foreground">Sepertinya ada gangguan sesaat. Coba lagi ya.</p>
          <button
            onClick={fetchData}
            className="mt-4 rounded-full brand-gradient px-6 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]"
          >
            Coba Lagi
          </button>
        </div>
      </AppScreen>
    );
  }

  if (loading || !kelompok) {
    return (
      <AppScreen>
        <div className="space-y-4 px-5 pt-8">
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-44 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
          <div className="h-64 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        </div>
      </AppScreen>
    );
  }

  const tk = getTingkatan(kelompok.tingkatan);

  return (
    <AppScreen>
      {/* Header */}
      <header className="px-5 pt-6">
        <button
          onClick={() => router.push('/dashboard')}
          aria-label="Kembali"
          className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
        >
          <ChevronLeft className="size-5 text-ink" />
        </button>
        <h1 className="mt-3 flex items-center gap-2 truncate text-2xl font-extrabold text-ink">
          <TingkatanIcon tingkatan={kelompok.tingkatan} className="size-6 text-primary" /> {kelompok.nama_kelompok}
        </h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          {tk.label} · <MapPin className="size-3.5" /> {kelompok.desa} · <Map className="size-3.5" /> {kelompok.daerah}
        </p>
      </header>

      {/* JADWAL */}
      <section className="px-5 pt-5">
        <div className="card-soft p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <CalendarDays className="size-4 text-primary" /> Jadwal Ngaji Mingguan
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pilih hari-hari pengajian berlangsung setiap minggunya:
          </p>
          <div className="mt-4 grid grid-cols-7 gap-1">
            {HARI_LIST.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => toggleHari(h)}
                className={`flex flex-col items-center gap-2 rounded-2xl py-2.5 text-xs font-semibold transition-colors ${
                  hariPilih.includes(h)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                <span className="text-[10px] font-medium">{h.slice(0,3)}</span>
                <span className={`size-1.5 rounded-full ${hariPilih.includes(h) ? 'bg-primary-foreground' : 'bg-border'}`} />
              </button>
            ))}
          </div>
          {hariPilih.length > 0 && (
            <p className="mt-3 text-xs font-semibold text-primary">
              Terpilih: {hariPilih.join(', ')}
            </p>
          )}
          <button
            onClick={handleSimpanJadwal}
            disabled={savingJadwal || hariPilih.length === 0}
            className="mt-4 w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {savingJadwal ? 'Menyimpan...' : jadwalSaved ? 'Jadwal Tersimpan!' : 'Simpan Jadwal'}
          </button>
        </div>
      </section>

      {/* MURID */}
      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Users className="size-4 text-primary" /> Daftar Murid
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-primary">{murid.length} orang</span>
            </h2>
            <button
              onClick={() => setModeBulk(!modeBulk)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-ink"
            >
              {modeBulk ? <Pencil className="size-3" /> : <ListChecks className="size-3" />}
              {modeBulk ? 'Satu per Satu' : 'Input Massal'}
            </button>
          </div>

          {/* Form tambah murid */}
          {!modeBulk ? (
            <form onSubmit={handleTambahMurid} className="mt-3 flex gap-2">
              <input
                placeholder="Nama murid..."
                value={namaMurid}
                onChange={e => setNamaMurid(e.target.value)}
                className="min-w-0 flex-1 rounded-full bg-secondary px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
              />
              <button type="submit" disabled={savingMurid} aria-label="Tambah murid"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-60">
                <Plus className="size-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleBulkMurid} className="mt-3">
              <textarea
                rows={6}
                placeholder="Satu nama per baris:&#10;Ahmad Fauzi&#10;Siti Nurhaliza&#10;Budi Santoso"
                value={bulkNama}
                onChange={e => setBulkNama(e.target.value)}
                className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
              />
              <button type="submit" disabled={savingMurid}
                className="mt-2 w-full rounded-full brand-gradient py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99] disabled:opacity-60">
                {savingMurid ? 'Menyimpan...' : 'Tambah Semua'}
              </button>
            </form>
          )}

          {/* List murid */}
          <div className="no-scrollbar mt-3 max-h-80 space-y-1.5 overflow-y-auto">
            {murid.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Belum ada murid. Tambahkan di atas.
              </div>
            ) : (
              murid.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2.5 rounded-2xl bg-secondary/60 p-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground">{i+1}</span>

                  {editId === m.id ? (
                    <>
                      <input
                        className="min-w-0 flex-1 rounded-full bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        value={editNama}
                        onChange={e => setEditNama(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSimpanEdit(m.id)}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSimpanEdit(m.id)}
                        disabled={savingEdit}
                        aria-label="Simpan"
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        onClick={() => { setEditId(null); setEditNama(''); }}
                        aria-label="Batal"
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-border text-muted-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.nama_murid}</span>
                      <button
                        onClick={() => { setEditId(m.id); setEditNama(m.nama_murid); }}
                        title="Edit"
                        aria-label={`Edit ${m.nama_murid}`}
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-primary"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleHapusMurid(m.id)}
                        title="Hapus"
                        aria-label={`Hapus ${m.nama_murid}`}
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Kelompok siap */}
      {murid.length > 0 && hariPilih.length > 0 && (
        <section className="px-5 pb-6 pt-5">
          <div className="rounded-3xl brand-gradient p-4 shadow-[var(--shadow-float)]">
            <p className="text-sm font-bold text-primary-foreground">
              Kelompok siap! {murid.length} murid · {hariPilih.length} hari/minggu
            </p>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => router.push(`/absensi/${kelompokId}`)}
                className="w-full rounded-full bg-white py-3 text-sm font-bold text-ink transition-transform active:scale-[0.99]"
              >
                Mulai Absensi
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/rekap/${kelompokId}`)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/20 py-2.5 text-xs font-bold text-primary-foreground"
                >
                  <BarChart3 className="size-3.5" /> Lihat Rekap
                </button>
                <button
                  onClick={() => router.push(`/admin/${kelompokId}`)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/20 py-2.5 text-xs font-bold text-primary-foreground"
                >
                  <UserCog className="size-3.5" /> Kelola Admin
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </AppScreen>
  );
}
