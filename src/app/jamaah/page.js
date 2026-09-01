'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { BackButton } from '@/components/BackButton';
import {
  IdCard, Plus, X, MapPin, Map, Users, Home, Pencil, Trash2, TriangleAlert, ChevronRight,
} from 'lucide-react';

const FORM_KOSONG = { nama_wilayah: '', desa: '', daerah: '' };

export default function JamaahListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data, isLoading, mutate } = useSWR(session ? '/api/wilayah-jamaah' : null);
  const wilayahList = Array.isArray(data) ? data : [];

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [saving, setSaving] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);
  const [hapusing, setHapusing] = useState(false);
  const [errorHapus, setErrorHapus] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  function bukaModalBaru() {
    setEditTarget(null);
    setForm(FORM_KOSONG);
    setShowModal(true);
  }

  function bukaModalEdit(w, e) {
    e.stopPropagation();
    setEditTarget(w);
    setForm({ nama_wilayah: w.nama_wilayah, desa: w.desa || '', daerah: w.daerah || '' });
    setShowModal(true);
  }

  async function handleSimpan(e) {
    e.preventDefault();
    setSaving(true);
    if (editTarget) {
      await fetch(`/api/wilayah-jamaah/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      mutate();
      setShowModal(false);
    } else {
      const res = await fetch('/api/wilayah-jamaah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const baru = await res.json();
        setShowModal(false);
        setForm(FORM_KOSONG);
        mutate();
        router.push(`/jamaah/${baru.id}`);
      }
    }
    setSaving(false);
  }

  async function handleHapus() {
    if (!hapusTarget) return;
    setHapusing(true);
    setErrorHapus('');
    const res = await fetch(`/api/wilayah-jamaah/${hapusTarget.id}`, { method: 'DELETE' });
    if (res.ok) {
      mutate();
      setHapusTarget(null);
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorHapus(data.error || 'Gagal menghapus wilayah.');
    }
    setHapusing(false);
  }

  const loading = status === 'loading' || isLoading;

  if (loading) {
    return (
      <AppScreen>
        <div className="space-y-4 px-5 pt-8">
          <div className="h-10 w-48 animate-pulse rounded-2xl bg-muted" />
          {[0, 1].map(i => <div key={i} className="h-32 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />)}
        </div>
      </AppScreen>
    );
  }

  return (
    <>
      <AppScreen>
        <header className="flex items-center justify-between px-5 pt-6">
          <div className="flex items-center gap-3">
            <BackButton
              fallbackHref="/dashboard"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
            />
            <div>
              <h1 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
                <IdCard className="size-5 text-primary" /> Manajemen Jamaah
              </h1>
              <p className="text-xs text-muted-foreground">Data jamaah per wilayah/dusun</p>
            </div>
          </div>
          <button
            aria-label="Wilayah Baru"
            onClick={bukaModalBaru}
            className="grid size-10 shrink-0 place-items-center rounded-full brand-gradient text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.95]"
          >
            <Plus className="size-5" />
          </button>
        </header>

        {wilayahList.length === 0 ? (
          <div className="card-soft mx-5 mt-6 p-6 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-primary">
              <Home className="size-7" />
            </div>
            <h3 className="mt-3 text-base font-extrabold text-ink">Belum ada data wilayah</h3>
            <p className="mt-1 text-sm text-muted-foreground">Buat wilayah/dusun untuk mulai mendata jamaah</p>
            <button
              onClick={bukaModalBaru}
              className="mt-4 w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]"
            >
              Buat Wilayah Pertama
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4 px-5">
            {wilayahList.map(w => (
              <div
                key={w.id}
                onClick={() => router.push(`/jamaah/${w.id}`)}
                className="block cursor-pointer rounded-3xl p-4 transition-transform active:scale-[0.99] card-soft"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-bold text-ink">{w.nama_wilayah}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
                {(w.desa || w.daerah) && (
                  <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {w.desa && <><MapPin className="size-3 shrink-0" /> {w.desa}</>}
                    {w.desa && w.daerah && <span className="opacity-60">·</span>}
                    {w.daerah && <><Map className="size-3.5 shrink-0" /> {w.daerah}</>}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-secondary p-2.5 text-center">
                    <p className="text-base font-extrabold text-ink">{w.stats?.jumlah_kk ?? 0}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground">KK</p>
                  </div>
                  <div className="rounded-2xl bg-secondary p-2.5 text-center">
                    <p className="text-base font-extrabold text-ink">{w.stats?.total ?? 0}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground">Jamaah</p>
                  </div>
                  <div className="rounded-2xl bg-secondary p-2.5 text-center">
                    <p className="text-base font-extrabold text-ink">{w.stats?.lansia ?? 0}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground">Lansia</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button onClick={e => { e.stopPropagation(); router.push(`/jamaah/${w.id}`); }} className="flex items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground">
                    <Users className="size-3.5" /> Kelola Jamaah
                  </button>
                  <button aria-label="Edit" onClick={e => bukaModalEdit(w, e)} className="grid size-8 place-items-center rounded-full bg-brand-soft text-primary">
                    <Pencil className="size-3.5" />
                  </button>
                  <button aria-label="Hapus" onClick={e => { e.stopPropagation(); setErrorHapus(''); setHapusTarget(w); }} className="grid size-8 place-items-center rounded-full bg-destructive/10 text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AppScreen>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" onClick={() => setShowModal(false)}>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8 shadow-[var(--shadow-float)]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold text-ink">{editTarget ? 'Edit Wilayah' : 'Wilayah Baru'}</span>
              <button aria-label="Tutup" onClick={() => setShowModal(false)} className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground"><X className="size-4" /></button>
            </div>
            <form onSubmit={handleSimpan} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nama Wilayah/Dusun</label>
                <input placeholder="cth: Dusun Krajan" value={form.nama_wilayah} onChange={e => setForm({ ...form, nama_wilayah: e.target.value })} required
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Desa (opsional)</label>
                <input placeholder="cth: Sukamaju" value={form.desa} onChange={e => setForm({ ...form, desa: e.target.value })}
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Daerah (opsional)</label>
                <input placeholder="cth: Daerah Kediri" value={form.daerah} onChange={e => setForm({ ...form, daerah: e.target.value })}
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full rounded-full brand-gradient py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Simpan & Lanjut'}
              </button>
            </form>
          </div>
        </div>
      )}

      {hapusTarget && (
        <div className="fixed inset-0 z-50 bg-ink/40" onClick={() => setHapusTarget(null)}>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8 text-center shadow-[var(--shadow-float)]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert className="size-7" />
            </div>
            <h3 className="mt-3 text-lg font-extrabold text-ink">Hapus Wilayah?</h3>
            <p className="mt-1 truncate text-sm font-semibold text-ink">{hapusTarget.nama_wilayah}</p>
            <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-xs font-medium text-destructive">
              Semua data jamaah di wilayah ini akan ikut terhapus permanen!
            </p>
            {errorHapus && <p className="mt-2 text-xs font-semibold text-destructive">{errorHapus}</p>}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setHapusTarget(null)} className="flex-1 rounded-full bg-secondary py-3.5 text-sm font-bold text-ink">Batal</button>
              <button onClick={handleHapus} disabled={hapusing} className="flex-1 rounded-full bg-destructive py-3.5 text-sm font-bold text-destructive-foreground active:scale-[0.99] disabled:opacity-60">
                {hapusing ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
