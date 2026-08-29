'use client';
import { SessionProvider } from 'next-auth/react';
import { SWRConfig } from 'swr';
import { InstallPrompt } from './InstallPrompt';
import { useEffect } from 'react';

export const fetcher = (url) =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(`Request gagal: ${res.status}`);
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

export function Providers({ children }) {
  return (
    <SessionProvider>
      <SWRConfig
        value={{
          fetcher,
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
