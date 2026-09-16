'use client';
import { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const PROMO_KEY = 'ag_promo_last_shown';
const PROMO_IMAGE = 'https://app.visbiz.co.id/imgserver/img/20260916_201829_74e0f8.png';
const PROMO_URL = PROMO_IMAGE;

function tanggalLokal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DailyPromoModal() {
  const pathname = usePathname();
  const { status } = useSession();
  const [visible, setVisible] = useState(false);
  const [sisa, setSisa] = useState(5);
  const [siapTutup, setSiapTutup] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || pathname === '/scan' || pathname.startsWith('/absensi/')) return undefined;
    if (localStorage.getItem(PROMO_KEY) === tanggalLokal()) return undefined;

    const timer = setTimeout(() => {
      localStorage.setItem(PROMO_KEY, tanggalLokal());
      setVisible(true);
      setSisa(5);
      setSiapTutup(false);
    }, 15000);
    return () => clearTimeout(timer);
  }, [pathname, status]);

  useEffect(() => {
    if (!visible || siapTutup) return undefined;
    const timer = setInterval(() => {
      setSisa(value => {
        if (value <= 1) {
          setSiapTutup(true);
          clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, siapTutup]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 px-5 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-[24rem] rounded-3xl bg-surface p-3 shadow-[var(--shadow-float)]">
        <button
          onClick={() => siapTutup && setVisible(false)}
          disabled={!siapTutup}
          aria-label="Tutup promosi"
          className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-ink/70 text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {siapTutup ? <X className="size-4" /> : <span className="text-xs font-bold">{sisa}</span>}
        </button>
        <img src={PROMO_IMAGE} alt="Promosi" className="w-full rounded-2xl object-cover" />
        <div className="flex gap-2 p-2 pb-1">
          <button
            onClick={() => siapTutup && setVisible(false)}
            disabled={!siapTutup}
            className="flex-1 rounded-full bg-secondary py-3 text-sm font-bold text-ink disabled:opacity-50"
          >
            {siapTutup ? 'Tutup' : `Tutup (${sisa})`}
          </button>
          <a href={PROMO_URL} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-full brand-gradient py-3 text-sm font-bold text-primary-foreground">
            Lihat <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
