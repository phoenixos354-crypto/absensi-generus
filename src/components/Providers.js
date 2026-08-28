'use client';
import { SessionProvider } from 'next-auth/react';
import { SWRConfig } from 'swr';

export const fetcher = (url) =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(`Request gagal: ${res.status}`);
    return res.json();
  });

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
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
