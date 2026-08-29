'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { getTingkatan } from '@/components/tingkatan';
import { KATEGORI, URUTAN_TINGKATAN } from '@/lib/target-constants';
import { ChevronLeft, Layers, Check, Plus, X, Save, Sparkles } from 'lucide-react';

const TINGKATAN_TABS = [
  { key: 'caberawit', label: 'Caberawit' },
  { key: 'praremaja', label: 'Pra Remaja' },
  { key: 'remaja', label: 'Remaja' },
  { key: 'usianikah', label: 'Usia Nikah' },
];

export default function PengaturanTargetPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;
  // Sama seperti halaman kartu murid: cache SWR di app ini pakai provider
  // custom, jadi mutate wajib dari useSWRConfig() biar nempel ke cache
  // yang benar (bukan cache default global yang gak kebaca siapa-siapa).
  const { mutate } = useSWRConfig();

  const [tingkatanEdit, setTingkatanEdit] = useState(null);
  const [kategoriEdit, setKategoriEdit] = useState(KATEGORI[0].key);
  const [draftItems, setDraftItems] = useState(null); // array nama_item saat diedit
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bikinPreset, setBikinPreset] = useState(false);
  const [namaPresetBaru, setNamaPresetBaru] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  const { data: kelompok } = useSWR(session && kelompokId ? `/api/kelompok/${kelompokId}` : null, {
    onSuccess: (d) => { if (!tingkatanEdit && d?.tingkatan) setTingkatanEdit(d.tingkatan); },
  });
  const { data: presetList } = useSWR(session && kelompokId ? `/api/target-preset?kelompok_id=${kelompokId}` : null);
  const { data: itemData } = useSWR(
    session && kelompokId && tingkatanEdit ? `/api/target-item?kelompok_id=${kelompokId}&tingkatan=${tingkatanEdit}&kategori=${kategoriEdit}` : null,
    { onSuccess: (d) => setDraftItems((d?.items || []).map(i => ({ id: i.id, nama_item: i.nama_item }))) }
  );

  if (kelompok && kelompok.permission !== 'owner') {
    return (
      <AppScreen>
        <div className="px-5 pt-10 text-center">
          <p className="text-sm font-semibold text-muted-foreground">Cuma owner kelompok yang bisa mengelola target.</p>
          <button onClick={() => router.push(`/target/${kelompokId}`)} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-primary-foreground">
            Kembali
          </button>
        </div>
      </AppScreen>
    );
  }

  const presetSaatIni = presetList?.find(p => p.id === (kelompok?.preset_id || 'default'));

  async function ikutiPreset(presetId) {
    await fetch(`/api/kelompok/${kelompokId}/preset`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset_id: presetId }),
    });
    mutate(`/api/kelompok/${kelompokId}`);
    mutate(`/api/target-item?kelompok_id=${kelompokId}&tingkatan=${tingkatanEdit}&kategori=${kategoriEdit}`);
  }

  async function buatPresetBaru() {
    if (!namaPresetBaru.trim()) return;
    await fetch('/api/target-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, nama_preset: namaPresetBaru.trim(), source_preset_id: kelompok?.preset_id || 'default' }),
    });
    setBikinPreset(false);
    setNamaPresetBaru('');
    mutate(`/api/kelompok/${kelompokId}`);
    mutate(`/api/target-preset?kelompok_id=${kelompokId}`);
  }

  function ubahNamaItem(idx, value) {
    setDraftItems(prev => prev.map((it, i) => i === idx ? { ...it, nama_item: value } : it));
  }
  function hapusItem(idx) {
    setDraftItems(prev => prev.filter((_, i) => i !== idx));
  }
  function tambahItem() {
    setDraftItems(prev => [...prev, { nama_item: '' }]);
  }

  async function simpanItem() {
    setSaving(true);
    const items = (draftItems || []).filter(i => i.nama_item.trim() !== '');
    await fetch('/api/target-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, tingkatan: tingkatanEdit, kategori: kategoriEdit, items }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    mutate(`/api/kelompok/${kelompokId}`);
    mutate(`/api/target-item?kelompok_id=${kelompokId}&tingkatan=${tingkatanEdit}&kategori=${kategoriEdit}`);
    mutate(`/api/target-preset?kelompok_id=${kelompokId}`);
  }

  return (
    <AppScreen>
      <header className="flex items-center gap-3 px-5 pt-6">
        <button
          onClick={() => router.push(`/target/${kelompokId}`)}
          aria-label="Kembali"
          className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
        >
          <ChevronLeft className="size-5 text-ink" />
        </button>
        <h1 className="text-lg font-extrabold text-ink">Kelola Target</h1>
      </header>

      {/* Preset yang lagi diikuti */}
      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <Layers className="size-4 text-primary" /> Mengikuti Target
          </h2>
          <p className="mt-1 text-sm font-bold text-primary">{presetSaatIni?.nama_preset || 'Target Default'}</p>
          {presetSaatIni?.nama_kelompok_asal && (
            <p className="text-xs text-muted-foreground">Dibuat oleh {presetSaatIni.nama_kelompok_asal}</p>
          )}

          <p className="mt-4 mb-2 text-xs font-semibold text-muted-foreground">Ganti ke preset lain:</p>
          <div className="space-y-2">
            {(presetList || []).map(p => (
              <button
                key={p.id}
                onClick={() => ikutiPreset(p.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left ${
                  (kelompok?.preset_id || 'default') === p.id ? 'bg-brand-soft' : 'bg-secondary'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{p.nama_preset}</span>
                  {p.nama_kelompok_asal && <span className="block truncate text-xs text-muted-foreground">{p.nama_kelompok_asal}{p.desa_asal ? ` · ${p.desa_asal}` : ''}</span>}
                </span>
                {(kelompok?.preset_id || 'default') === p.id && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            ))}
          </div>

          {!bikinPreset ? (
            <button
              onClick={() => setBikinPreset(true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-ink px-4 py-3 text-xs font-bold text-primary-foreground"
            >
              <Sparkles className="size-4" /> Buat Preset Baru
            </button>
          ) : (
            <div className="mt-3 rounded-2xl bg-secondary p-3.5">
              <input
                value={namaPresetBaru}
                onChange={e => setNamaPresetBaru(e.target.value)}
                placeholder="Nama preset, mis. Target Desa Sukamaju"
                className="w-full rounded-xl bg-surface px-3.5 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">Dimulai dari salinan target yang lagi diikuti sekarang, lalu diedit di bawah.</p>
              <div className="mt-2.5 flex gap-2">
                <button onClick={() => setBikinPreset(false)} className="flex-1 rounded-xl bg-surface py-2.5 text-xs font-bold text-ink">Batal</button>
                <button onClick={buatPresetBaru} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground">Buat</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Editor item */}
      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <h2 className="text-sm font-extrabold text-ink">Edit Daftar Item</h2>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {TINGKATAN_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTingkatanEdit(t.key)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${
                  tingkatanEdit === t.key ? 'bg-ink text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
            {KATEGORI.map(k => (
              <button
                key={k.key}
                onClick={() => setKategoriEdit(k.key)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold ${
                  kategoriEdit === k.key ? 'bg-brand-soft text-primary' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {(draftItems || []).map((it, idx) => (
              <div key={it.id || `baru-${idx}`} className="flex items-center gap-2">
                <input
                  value={it.nama_item}
                  onChange={e => ubahNamaItem(idx, e.target.value)}
                  placeholder={`Item ${idx + 1}`}
                  className="w-full rounded-xl bg-secondary px-3.5 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button onClick={() => hapusItem(idx)} aria-label="Hapus" className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {(!draftItems || draftItems.length === 0) && (
              <p className="py-2 text-center text-xs text-muted-foreground">Belum ada item. Tambahkan di bawah.</p>
            )}
          </div>

          <button onClick={tambahItem} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-secondary py-2.5 text-xs font-bold text-ink">
            <Plus className="size-4" /> Tambah Item
          </button>

          <button
            onClick={simpanItem}
            disabled={saving}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saved ? <><Check className="size-4" /> Tersimpan</> : <><Save className="size-4" /> {saving ? 'Menyimpan...' : 'Simpan'}</>}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Kalau target ini masih ikut punya kelompok/desa lain, menyimpan otomatis membuat salinan sendiri.
          </p>
        </div>
      </section>
    </AppScreen>
  );
}
