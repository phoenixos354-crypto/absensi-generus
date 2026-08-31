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
        {children}
        <InstallPrompt />
      </SWRConfig>
    </SessionProvider>
  );
}
