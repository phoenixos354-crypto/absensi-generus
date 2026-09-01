'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { BackButton } from '@/components/BackButton';
import {
  KATEGORI_USIA_JAMAAH, JENIS_KELAMIN_JAMAAH, STATUS_PERNIKAHAN_JAMAAH, STATUS_KELUARGA_JAMAAH,
  getKategoriUsiaJamaah, getStatusKeluargaLabel,
} from '@/lib/jamaah-constants';
import {
  Share2, X, Plus, MapPin, Map, Users, Home, Heart, HeartCrack, Venus, Mars,
  Pencil, Trash2, TriangleAlert, ChevronDown, UserRound,
} from 'lucide-react';

const FORM_KOSONG = {
  nama: '', umur: '', jenis_kelamin: 'L', status_pernikahan: 'belum_menikah',
  kategori_usia: 'caberawit', status_keluarga: 'lainnya', kepala_keluarga_id: '',
};

export default function WilayahJamaahDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const wilayahId = params.id;

  const { data: wilayah, isLoading, mutate } = useSWR(
    session && wilayahId ? `/api/wilayah-jamaah/${wilayahId}` : null,
    { onError: (err) => { if ([401, 403, 404].includes(err?.status)) router.replace('/jamaah'); } }
  );

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [saving, setSaving] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [hapusTarget, setHapusTarget] = useState(null);
  const [hapusing, setHapusing] = useState(false);
  const [errorHapus, setErrorHapus] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  function bukaModalBaru() {
    setEditTarget(null);
    setErrorForm('');
    setForm(FORM_KOSONG);
    setShowModal(true);
  }

  function bukaModalEdit(j) {
    setEditTarget(j);
    setErrorForm('');
    setForm({
      nama: j.nama, umur: j.umur || '', jenis_kelamin: j.jenis_kelamin || 'L',
      status_pernikahan: j.status_pernikahan || 'belum_menikah',
      kategori_usia: j.kategori_usia || 'caberawit',
      status_keluarga: j.status_keluarga || 'lainnya',
      kepala_keluarga_id: j.kepala_keluarga_id || '',
    });
    setShowModal(true);
  }

  async function handleSimpan(e) {
    e.preventDefault();
    setSaving(true);
    setErrorForm('');

    const payload = { ...form, wilayah_id: wilayahId };
    const url = editTarget ? `/api/jamaah/${editTarget.id}` : '/api/jamaah';
    const method = editTarget ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      mutate();
      setShowModal(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorForm(data.error || 'Gagal menyimpan data jamaah.');
    }
    setSaving(false);
  }

  async function handleHapus() {
    if (!hapusTarget) return;
    setHapusing(true);
    setErrorHapus('');
    const res = await fetch(`/api/jamaah/${hapusTarget.id}`, { method: 'DELETE' });
    if (res.ok) {
      mutate();
      setHapusTarget(null);
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorHapus(data.error || 'Gagal menghapus data.');
    }
    setHapusing(false);
  }

  async function bagikanKartu() {
    if (!wilayah?.kode_publik) return;
    const url = `${window.location.origin}/kartu-jamaah/${wilayah.kode_publik}`;
    const dataShare = {
      title: `Data Jamaah ${wilayah.nama_wilayah}`,
      text: `Lihat rekap data jamaah wilayah ${wilayah.nama_wilayah}`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(dataShare);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          await navigator.clipboard?.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading || !wilayah) {
    return (
      <AppScreen>
        <div className="space-y-4 px-5 pt-8">
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-40 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        </div>
      </AppScreen>
    );
  }

  const daftarJamaah = wilayah.jamaah || [];
  const stats = wilayah.stats || {};
  const daftarKK = daftarJamaah.filter(j => j.status_keluarga === 'kepala_keluarga' && j.id !== editTarget?.id);

  const STAT_CARDS = [
    { key: 'jumlah_kk', label: 'Kepala Keluarga', Icon: Home },
    { key: 'total', label: 'Total Jamaah', Icon: Users },
    { key: 'laki_laki', label: 'Laki-laki', Icon: Mars },
    { key: 'perempuan', label: 'Perempuan', Icon: Venus },
    { key: 'lansia', label: 'Lansia', Icon: UserRound },
    { key: 'janda', label: 'Janda', Icon: HeartCrack },
    { key: 'duda', label: 'Duda', Icon: HeartCrack },
    { key: 'muda_mudi', label: 'Muda-Mudi', Icon: Users },
    { key: 'usia_nikah', label: 'Usia Nikah', Icon: Heart },
    { key: 'caberawit', label: 'Caberawit', Icon: UserRound },
  ];

  return (
    <>
      <AppScreen>
        <header className="flex items-center justify-between px-5 pt-6">
          <BackButton
            fallbackHref="/jamaah"
            className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
          />
          <button
            onClick={bagikanKartu}
            className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-xs font-bold text-ink shadow-[var(--shadow-card)]"
          >
            <Share2 className="size-4" /> {copied ? 'Tersalin!' : 'Bagikan Kartu Data'}
          </button>
        </header>

        <section className="px-5 pt-4">
          <div className="rounded-3xl brand-gradient p-4 shadow-[var(--shadow-float)]">
            <h1 className="text-xl font-extrabold text-primary-foreground">{wilayah.nama_wilayah}</h1>
            {(wilayah.desa || wilayah.daerah) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {wilayah.desa && (
                  <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
                    <MapPin className="size-3" /> {wilayah.desa}
                  </span>
                )}
                {wilayah.daerah && (
                  <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
                    <Map className="size-3.5" /> {wilayah.daerah}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="px-5 pt-4">
          <div className="card-soft p-4">
            <h2 className="text-sm font-extrabold text-ink">Rekap Data Jamaah</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {STAT_CARDS.map(({ key, label, Icon }) => (
                <div key={key} className="flex items-center gap-2.5 rounded-2xl bg-secondary p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                    <Icon className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold leading-none text-ink">{stats[key] ?? 0}</p>
                    <p className="truncate text-[10px] font-semibold text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Users className="size-4 text-primary" /> Daftar Jamaah ({daftarJamaah.length})
            </h2>
            <button
              onClick={bukaModalBaru}
              className="flex items-center gap-1 rounded-full brand-gradient px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-[var(--shadow-card)]"
            >
              <Plus className="size-3.5" /> Tambah
            </button>
          </div>

          {daftarJamaah.length === 0 ? (
            <div className="card-soft mt-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">Belum ada data jamaah di wilayah ini.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              {daftarJamaah.map(j => {
                const kat = getKategoriUsiaJamaah(j.kategori_usia);
                const kepalaKeluarga = j.kepala_keluarga_id ? daftarJamaah.find(x => x.id === j.kepala_keluarga_id) : null;
                return (
                  <div key={j.id} className="card-soft p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{j.nama}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {j.umur && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {j.umur} th
                            </span>
                          )}
                          {j.jenis_kelamin && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {JENIS_KELAMIN_JAMAAH.find(k => k.key === j.jenis_kelamin)?.label}
                            </span>
                          )}
                          {kat && (
                            <span className="flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                              <kat.Icon className="size-3" /> {kat.label}
                            </span>
                          )}
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {getStatusKeluargaLabel(j.status_keluarga)}
                          </span>
                        </div>
                        {kepalaKeluarga && (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            Ikut KK: <span className="font-semibold text-ink">{kepalaKeluarga.nama}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button aria-label="Edit" onClick={() => bukaModalEdit(j)} className="grid size-8 place-items-center rounded-full bg-brand-soft text-primary">
                          <Pencil className="size-3.5" />
                        </button>
                        <button aria-label="Hapus" onClick={() => { setErrorHapus(''); setHapusTarget(j); }} className="grid size-8 place-items-center rounded-full bg-destructive/10 text-destructive">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </AppScreen>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 backdrop-blur-[2px]" onClick={() => setShowModal(false)}>
          <div className="mx-auto mt-8 max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8 shadow-[var(--shadow-float)]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold text-ink">{editTarget ? 'Edit Jamaah' : 'Tambah Jamaah'}</span>
              <button aria-label="Tutup" onClick={() => setShowModal(false)} className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground"><X className="size-4" /></button>
            </div>
            <form onSubmit={handleSimpan} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nama</label>
                <input placeholder="cth: Ahmad Fauzi" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} required
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Umur</label>
                  <input type="number" min="0" max="120" placeholder="cth: 35" value={form.umur} onChange={e => setForm({ ...form, umur: e.target.value })}
                    className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Jenis Kelamin</label>
                  <div className="relative">
                    <select value={form.jenis_kelamin} onChange={e => setForm({ ...form, jenis_kelamin: e.target.value })}
                      className="w-full appearance-none rounded-2xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40">
                      {JENIS_KELAMIN_JAMAAH.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Kategori Usia</label>
                <div className="relative">
                  <select value={form.kategori_usia} onChange={e => setForm({ ...form, kategori_usia: e.target.value })}
                    className="w-full appearance-none rounded-2xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40">
                    {KATEGORI_USIA_JAMAAH.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Status Pernikahan</label>
                <div className="relative">
                  <select value={form.status_pernikahan} onChange={e => setForm({ ...form, status_pernikahan: e.target.value })}
                    className="w-full appearance-none rounded-2xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40">
                    {STATUS_PERNIKAHAN_JAMAAH.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Status dalam Keluarga</label>
                <div className="relative">
                  <select value={form.status_keluarga} onChange={e => setForm({ ...form, status_keluarga: e.target.value, kepala_keluarga_id: '' })}
                    className="w-full appearance-none rounded-2xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40">
                    {STATUS_KELUARGA_JAMAAH.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {form.status_keluarga === 'anggota_keluarga' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ikut Kepala Keluarga</label>
                  <div className="relative">
                    <select value={form.kepala_keluarga_id} onChange={e => setForm({ ...form, kepala_keluarga_id: e.target.value })} required
                      className="w-full appearance-none rounded-2xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40">
                      <option value="">Pilih kepala keluarga...</option>
                      {daftarKK.map(kk => <option key={kk.id} value={kk.id}>{kk.nama}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  {daftarKK.length === 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">Belum ada Kepala Keluarga di wilayah ini. Tambahkan Kepala Keluarga dulu.</p>
                  )}
                </div>
              )}

              {errorForm && <p className="text-xs font-semibold text-destructive">{errorForm}</p>}

              <button type="submit" disabled={saving}
                className="w-full rounded-full brand-gradient py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Simpan'}
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
            <h3 className="mt-3 text-lg font-extrabold text-ink">Hapus Data Jamaah?</h3>
            <p className="mt-1 truncate text-sm font-semibold text-ink">{hapusTarget.nama}</p>
            {errorHapus && <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-xs font-medium text-destructive">{errorHapus}</p>}
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
