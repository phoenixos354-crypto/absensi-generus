'use client';
import { SessionProvider } from 'next-auth/react';
import { SWRConfig } from 'swr';
import { InstallPrompt } from './InstallPrompt';
import { useEffect } from 'react';

export const fetcher = (url) =>
  fetch(url).then(res => {
    if (!res.ok) {
      const error = new Error(`Request gagal: ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  });

function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}

// Catat panjang history browser begitu app pertama kali dibuka (sekali per
// tab/sesi, disimpan di sessionStorage). Dipakai oleh <BackButton> untuk
// tahu apakah halaman saat ini punya riwayat in-app buat di-back-in, atau
// harus fallback ke navigasi biasa (misal: dibuka langsung lewat deep link).
function TrackEntryHistory() {
  useEffect(() => {
    if (!sessionStorage.getItem('ag_entry_history_len')) {
      sessionStorage.setItem('ag_entry_history_len', String(window.history.length));
    }
  }, []);
  return null;
}

const CACHE_KEY = 'absensi-generus-swr-cache';

// Cache SWR yang disimpan ke localStorage supaya bertahan lintas sesi.
// Efeknya: begitu app dibuka lagi (bahkan setelah ditutup total, bukan cuma
// pindah halaman), data terakhir langsung muncul di layar tanpa loading
// kosong, sambil SWR diam-diam ambil data terbaru di belakang layar
// (stale-while-revalidate) dan menimpa tampilan begitu datang.
function localStorageProvider() {
  if (typeof window === 'undefined') return new Map();

  let map;
  try {
    map = new Map(JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'));
  } catch {
    map = new Map();
  }

  const persist = () => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(map.entries())));
    } catch {
      // localStorage penuh / mode private — abaikan, tidak fatal
    }
  };

  // 'visibilitychange' + 'pagehide' lebih diandalkan daripada 'beforeunload'
  // di HP/PWA, karena app sering langsung di-suspend/ditutup tanpa unload event.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
  window.addEventListener('pagehide', persist);

  return map;
}

export function Providers({ children }) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          fetcher,
          provider: localStorageProvider,
          revalidateOnFocus: true,
          revalidateIfStale: true,
          dedupingInterval: 2000,
        }}
      >
        <RegisterServiceWorker />
        <TrackEntryHistory />
        {children}
        <InstallPrompt />
      </SWRConfig>
    </SessionProvider>
  );
}
