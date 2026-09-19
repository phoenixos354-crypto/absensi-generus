'use client';
import { useEffect, useState } from 'react';
import { useBebasIklan } from '@/lib/bebas-iklan';

const SPLASH_IMG = 'https://app.visbiz.co.id/imgserver/img/20260916_201829_74e0f8.png';
const DURASI_DETIK = 5;
const STORAGE_KEY = 'ag_splash_ad_seen';

export function SplashAd() {
  const [tampil, setTampil] = useState(false);
  const [sisa, setSisa] = useState(DURASI_DETIK);
  const [gagalMuat, setGagalMuat] = useState(false);
  const { siap, bebas } = useBebasIklan();

  // Tampil sekali per sesi tab: buka app baru (tab baru) -> muncul lagi,
  // pindah-pindah halaman di dalam app -> tidak muncul lagi.
  // Kelompok bebas iklan (mis. Loceret, Nganjuk) tidak pernah melihat splash.
  useEffect(() => {
    if (!siap || bebas) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {}
    setTampil(true);
  }, [siap, bebas]);

  // Hitung mundur 5 -> 0
  useEffect(() => {
    if (!tampil) return;
    if (sisa <= 0) return;
    const t = setTimeout(() => setSisa(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [tampil, sisa]);

  // Otomatis masuk aplikasi begitu countdown selesai
  useEffect(() => {
    if (!tampil || sisa > 0) return;
    const t = setTimeout(tutup, 600);
    return () => clearTimeout(t);
  }, [tampil, sisa]);

  function tutup() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setTampil(false);
  }

  if (!tampil || bebas) return null;

  const bisaMasuk = sisa <= 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-5 backdrop-blur-[2px]">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-float)]">
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Iklan
          </span>
          <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-extrabold text-primary-foreground">
            {sisa > 0 ? sisa : '✓'}
          </span>
        </div>

        <div className="px-4 pt-3">
          {gagalMuat ? (
            <div className="grid max-h-[60vh] min-h-48 place-items-center rounded-2xl bg-secondary p-6 text-center text-xs font-semibold text-muted-foreground">
              Gambar splash tidak dapat dimuat.
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={SPLASH_IMG}
              alt="Splash"
              className="max-h-[60vh] w-full rounded-2xl object-contain"
              onError={() => setGagalMuat(true)}
            />
          )}
        </div>

        {/* Progress bar countdown */}
        <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000"
            style={{ width: `${((DURASI_DETIK - sisa) / DURASI_DETIK) * 100}%` }}
          />
        </div>

        <div className="p-4">
          <button
            onClick={tutup}
            disabled={!bisaMasuk}
            className="w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99] disabled:opacity-60"
          >
            {bisaMasuk ? 'Masuk Aplikasi' : `Masuk Aplikasi (${sisa})`}
          </button>
          {!bisaMasuk && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Mohon tunggu {sisa} detik untuk masuk aplikasi…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
