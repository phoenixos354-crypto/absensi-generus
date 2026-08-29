'use client';
import { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';

const DISMISS_KEY = 'ag_install_dismissed';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    function handleBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS Safari never fires beforeinstallprompt, so show manual instructions instead.
    if (isIos()) {
      setShowIosBanner(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  }

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.75rem] z-40 flex justify-center px-5">
      <div className="pointer-events-auto flex w-full max-w-[26rem] items-center gap-3 rounded-2xl bg-ink p-3.5 pr-3 text-primary-foreground shadow-[var(--shadow-float)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Absensi Generus" width={40} height={40} className="size-10 shrink-0 rounded-xl" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold">Instal Absensi Generus</p>
          <p className="truncate text-[11px] text-primary-foreground/70">
            {showIosBanner
              ? 'Tap Share lalu "Add to Home Screen"'
              : 'Akses lebih cepat langsung dari HP kamu'}
          </p>
        </div>

        {!showIosBanner && (
          <button
            onClick={handleInstallClick}
            aria-label="Instal aplikasi"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground active:scale-[0.97]"
          >
            <Download className="size-3.5" /> Instal
          </button>
        )}
        {showIosBanner && (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15">
            <Share className="size-4" />
          </span>
        )}

        <button
          onClick={dismiss}
          aria-label="Tutup"
          className="grid size-7 shrink-0 place-items-center rounded-full text-primary-foreground/60"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
