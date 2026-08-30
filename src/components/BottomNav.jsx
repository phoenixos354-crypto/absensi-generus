'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, BarChart3, Plus, Target } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  useEffect(() => {
    const m = pathname.match(/^\/(absensi|rekap|kelompok|setup|admin)\/([^/]+)/);
    if (m) localStorage.setItem('ag_last_kelompok', m[2]);
  }, [pathname]);

  const items = [
    { href: '/dashboard', icon: Home, label: 'Dashboard', active: pathname === '/dashboard' },
    { href: '/rekap', icon: BarChart3, label: 'Rekap', active: pathname.startsWith('/rekap') && !pathname.startsWith('/rekap-target') },
    { href: '/dashboard?baru=1', icon: Plus, label: 'Kelompok Baru', active: false },
    // Menu "?" (Panduan) dihapus dari sini karena sudah ada tombol yang sama
    // di header halaman Dashboard — diganti Rekap Target biar gak duplikat.
    { href: '/rekap-target', icon: Target, label: 'Rekap Target', active: pathname.startsWith('/rekap-target') },
  ];

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex w-full justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full bg-ink p-2 shadow-[var(--shadow-float)]">
        {items.map(({ href, icon: Icon, label, active }) => (
          <li key={label}>
            <Link
              href={href}
              aria-label={label}
              className={`flex size-12 items-center justify-center rounded-full transition-colors ${
                active ? 'bg-primary text-primary-foreground' : 'text-primary-foreground/60'
              }`}
            >
              <Icon className="size-5" strokeWidth={2} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
