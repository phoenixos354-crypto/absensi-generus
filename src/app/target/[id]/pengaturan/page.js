'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { KATEGORI, KELAS_CABERAWIT } from '@/lib/target-constants';
import { ChevronLeft, Layers, Check, Plus, X, Save, Sparkles, KeyRound, Copy, Undo2, Lock } from 'lucide-react';

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
  const [draftItems, setDraftItems] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorSimpan, setErrorSimpan] = useState('');

  const [modeGanti, setModeGanti] = useState(null); // null | 'buat' | 'ikuti'
  const [namaPresetBaru, setNamaPresetBaru] = useState('');
  const [kodeInput, setKodeInput] = useState('');
  const [errorGanti, setErrorGanti] = useState('');
  const [loadingGanti, setLoadingGanti] = useState(false);
  const [kodeDisalin, setKodeDisalin] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  const { data: kelompok } = useSWR(session && kelompokId ? `/api/kelompok/${kelompokId}` : null, {
    onSuccess: (d) => { if (!tingkatanEdit && d?.tingkatan) setTingkatanEdit(d.tingkatan); },
  });
  const { data: presetInfo, isLoading: presetLoading } = useSWR(session && kelompokId ? `/api/target-preset?kelompok_id=${kelompokId}` : null);
  const { data: itemData } = useSWR(
    session && kelompokId && tingkatanEdit ? `/api/target-item?kelompok_id=${kelompokId}&tingkatan=${tingkatanEdit}&kategori=${kategoriEdit}` : null,
    { onSuccess: (d) => setDraftItems((d?.items || []).map(i => ({ id: i.id, nama_item: i.nama_item, kelas: i.kelas || '' }))) }
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

  const milikSendiri = !!presetInfo?.milik_sendiri;
  const bisaEdit = milikSendiri; // Target Default & custom target orang lain tidak bisa diedit

  function refreshSemua() {
    mutate(`/api/kelompok/${kelompokId}`);
    mutate(`/api/target-preset?kelompok_id=${kelompokId}`);
    mutate(`/api/target-item?kelompok_id=${kelompokId}&tingkatan=${tingkatanEdit}&kategori=${kategoriEdit}`);
  }

  async function buatCustomTargetBaru() {
    if (!namaPresetBaru.trim()) return;
    setLoadingGanti(true);
    setErrorGanti('');
    const res = await fetch('/api/target-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, nama_preset: namaPresetBaru.trim() }),
    });
    const data = await res.json();
    setLoadingGanti(false);
    if (!res.ok) { setErrorGanti(data.error || 'Gagal membuat custom target'); return; }
    setModeGanti(null);
    setNamaPresetBaru('');
    refreshSemua();
  }

  async function ikutiKode() {
    if (!kodeInput.trim()) return;
    setLoadingGanti(true);
    setErrorGanti('');
    const res = await fetch('/api/target-preset/ikuti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, kode: kodeInput.trim() }),
    });
    const data = await res.json();
    setLoadingGanti(false);
    if (!res.ok) { setErrorGanti(data.error || 'Gagal mengikuti target'); return; }
    setModeGanti(null);
    setKodeInput('');
    refreshSemua();
  }

  async function kembaliKeDefault() {
    setLoadingGanti(true);
    await fetch(`/api/kelompok/${kelompokId}/preset`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset_id: 'default' }),
    });
    setLoadingGanti(false);
    refreshSemua();
  }

  function salinKode() {
    if (!presetInfo?.kode) return;
    navigator.clipboard?.writeText(presetInfo.kode);
    setKodeDisalin(true);
    setTimeout(() => setKodeDisalin(false), 1800);
  }

  function ubahNamaItem(idx, value) {
    setDraftItems(prev => prev.map((it, i) => i === idx ? { ...it, nama_item: value } : it));
  }
  function ubahKelasItem(idx, value) {
    setDraftItems(prev => prev.map((it, i) => i === idx ? { ...it, kelas: value } : it));
  }
  function hapusItem(idx) {
    setDraftItems(prev => prev.filter((_, i) => i !== idx));
  }
  function tambahItem() {
    setDraftItems(prev => [...prev, { nama_item: '', kelas: '' }]);
  }

  async function simpanItem() {
    setSaving(true);
    setErrorSimpan('');
    const items = (draftItems || [])
      .filter(i => i.nama_item.trim() !== '')
      .map(i => ({ id: i.id, nama_item: i.nama_item, kelas: i.kelas || '' }));
    const res = await fetch('/api/target-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, tingkatan: tingkatanEdit, kategori: kategoriEdit, items }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErrorSimpan(data.error || 'Gagal menyimpan'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    mutate(`/api/target-item?kelompok_id=${kelompokId}&tingkatan=${tingkatanEdit}&kategori=${kategoriEdit}`);
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

      {/* Target yang lagi diikuti */}
      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <Layers className="size-4 text-primary" /> Target yang Diikuti
          </h2>

          {!presetLoading && presetInfo && (
            <>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-sm font-bold text-primary">{presetInfo.nama_preset}</p>
                {!milikSendiri && (
                  <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    <Lock className="size-3" /> Tidak bisa diedit
                  </span>
                )}
              </div>
              {presetInfo.is_default && (
                <p className="mt-0.5 text-xs text-muted-foreground">Target bawaan aplikasi. Untuk mengubahnya, buat Custom Target sendiri di bawah.</p>
              )}
              {!presetInfo.is_default && !milikSendiri && presetInfo.nama_kelompok_asal && (
                <p className="mt-0.5 text-xs text-muted-foreground">Dibuat oleh {presetInfo.nama_kelompok_asal}. Kalau mau mengubahnya, buat Custom Target sendiri.</p>
              )}
              {milikSendiri && presetInfo.kode && (
                <div className="mt-3 rounded-2xl bg-secondary p-3.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">Kode Custom Target Ini</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="flex-1 rounded-xl bg-surface px-3.5 py-2.5 text-center text-base font-extrabold tracking-widest text-ink">{presetInfo.kode}</p>
                    <button onClick={salinKode} aria-label="Salin kode" className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-ink">
                      {kodeDisalin ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Bagikan kode ini ke kelompok lain supaya mereka bisa ikut pakai target yang sama seperti kelompok ini.</p>
                </div>
              )}
            </>
          )}

          {/* Aksi ganti target */}
          {modeGanti === null && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => { setModeGanti('buat'); setErrorGanti(''); }}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-ink px-3 py-3 text-center text-[11px] font-bold text-primary-foreground"
              >
                <Sparkles className="size-4" /> Buat Custom Target
              </button>
              <button
                onClick={() => { setModeGanti('ikuti'); setErrorGanti(''); }}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-secondary px-3 py-3 text-center text-[11px] font-bold text-ink"
              >
                <KeyRound className="size-4" /> Masukkan Kode Target
              </button>
            </div>
          )}
          {!presetInfo?.is_default && modeGanti === null && (
            <button
              onClick={kembaliKeDefault}
              disabled={loadingGanti}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-surface py-2.5 text-xs font-bold text-muted-foreground disabled:opacity-60"
            >
              <Undo2 className="size-4" /> Kembali ke Target Default
            </button>
          )}

          {modeGanti === 'buat' && (
            <div className="mt-3 rounded-2xl bg-secondary p-3.5">
              <p className="text-xs font-bold text-ink">Buat Custom Target Baru</p>
              <input
                value={namaPresetBaru}
                onChange={e => setNamaPresetBaru(e.target.value)}
                placeholder="Nama target, mis. Target Desa Sukamaju"
                className="mt-2 w-full rounded-xl bg-surface px-3.5 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">Dimulai dari salinan target yang sedang diikuti sekarang ({presetInfo?.nama_preset}), lalu bisa diedit bebas di bawah. Setelah dibuat, kamu dapat kode unik untuk dibagikan ke kelompok lain.</p>
              {errorGanti && <p className="mt-1.5 text-[11px] font-semibold text-destructive">{errorGanti}</p>}
              <div className="mt-2.5 flex gap-2">
                <button onClick={() => { setModeGanti(null); setErrorGanti(''); }} className="flex-1 rounded-xl bg-surface py-2.5 text-xs font-bold text-ink">Batal</button>
                <button onClick={buatCustomTargetBaru} disabled={loadingGanti} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60">
                  {loadingGanti ? 'Membuat...' : 'Buat'}
                </button>
              </div>
            </div>
          )}

          {modeGanti === 'ikuti' && (
            <div className="mt-3 rounded-2xl bg-secondary p-3.5">
              <p className="text-xs font-bold text-ink">Masukkan Kode Target</p>
              <input
                value={kodeInput}
                onChange={e => setKodeInput(e.target.value.toUpperCase())}
                placeholder="Mis. AB3XQ9ZK"
                className="mt-2 w-full rounded-xl bg-surface px-3.5 py-2.5 text-center text-sm font-bold uppercase tracking-widest text-ink outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">Minta kode ini ke kelompok yang sudah punya custom target yang mau kamu ikuti. Kelompok kamu akan langsung ikut pakai target itu.</p>
              {errorGanti && <p className="mt-1.5 text-[11px] font-semibold text-destructive">{errorGanti}</p>}
              <div className="mt-2.5 flex gap-2">
                <button onClick={() => { setModeGanti(null); setErrorGanti(''); }} className="flex-1 rounded-xl bg-surface py-2.5 text-xs font-bold text-ink">Batal</button>
                <button onClick={ikutiKode} disabled={loadingGanti} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60">
                  {loadingGanti ? 'Menyambungkan...' : 'Ikuti'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Editor item */}
      <section className="px-5 pt-4 pb-8">
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

          {!bisaEdit && !presetLoading && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-secondary p-3.5">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {presetInfo?.is_default
                  ? 'Target Default tidak bisa diedit. Pencet "Buat Custom Target" di atas untuk mulai mengedit isinya.'
                  : 'Target ini bukan buatan kelompok kamu, jadi tidak bisa diedit. Pencet "Buat Custom Target" di atas untuk membuat versi sendiri yang bisa diedit.'}
              </p>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {(draftItems || []).map((it, idx) => (
              <div key={it.id || `baru-${idx}`} className="rounded-xl bg-secondary p-2">
                <div className="flex items-center gap-2">
                  <input
                    value={it.nama_item}
                    onChange={e => ubahNamaItem(idx, e.target.value)}
                    placeholder={`Item ${idx + 1}`}
                    disabled={!bisaEdit}
                    className="w-full rounded-xl bg-surface px-3.5 py-2.5 text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                  />
                  {bisaEdit && (
                    <button onClick={() => hapusItem(idx)} aria-label="Hapus" className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-muted-foreground">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {tingkatanEdit === 'caberawit' && (
                  <select
                    value={it.kelas || ''}
                    onChange={e => ubahKelasItem(idx, e.target.value)}
                    disabled={!bisaEdit}
                    className="mt-1.5 w-full rounded-xl bg-surface px-3.5 py-2 text-xs font-semibold text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                  >
                    {KELAS_CABERAWIT.map(k => (
                      <option key={k.key} value={k.key}>{k.key ? `Untuk: ${k.label}` : k.label}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
            {(!draftItems || draftItems.length === 0) && (
              <p className="py-2 text-center text-xs text-muted-foreground">Belum ada item.</p>
            )}
          </div>

          {bisaEdit && (
            <>
              <button onClick={tambahItem} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-secondary py-2.5 text-xs font-bold text-ink">
                <Plus className="size-4" /> Tambah Item
              </button>

              {errorSimpan && <p className="mt-2 text-center text-[11px] font-semibold text-destructive">{errorSimpan}</p>}

              <button
                onClick={simpanItem}
                disabled={saving}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {saved ? <><Check className="size-4" /> Tersimpan</> : <><Save className="size-4" /> {saving ? 'Menyimpan...' : 'Simpan'}</>}
              </button>
            </>
          )}
        </div>
      </section>
    </AppScreen>
  );
}
