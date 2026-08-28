'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (session) router.replace('/dashboard');
    else router.replace('/login');
  }, [session, status]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="size-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
    </div>
  );
}
