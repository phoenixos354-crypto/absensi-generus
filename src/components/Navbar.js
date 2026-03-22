'use client';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export function Navbar() {
  const { data: session } = useSession();
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/dashboard" className="navbar-brand">
          <span className="logo-icon">🕌</span>
          Absensi Generus
        </Link>
        {session && (
          <div className="navbar-user">
            {session.user.image && (
              <img src={session.user.image} alt={session.user.name} />
            )}
            <span className="nama-user">{session.user.name}</span>
            <button className="navbar-logout" onClick={() => signOut({ callbackUrl: '/login' })}>
              Keluar
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
