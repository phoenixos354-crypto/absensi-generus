'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AppScreen } from '@/components/AppScreen';
import { ChevronLeft, Plus, Crown, CheckCircle2, Eye, Lightbulb } from 'lucide-react';

const PERMISSION_INFO = {
  owner:  { label: 'Owner',         Icon: Crown,        desc: 'Akses penuh' },
  absen:  { label: 'Pengabsen',     Icon: CheckCircle2, desc: 'Hanya bisa absen' },
  viewer: { label: 'Lihat Laporan', Icon: Eye,          desc: 'Hanya bisa lihat rekap' },
};

export default function AdminKelompokPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  // SWR: kelompok + daftar admin, cache tampil instan lalu revalidate background
  const { data: kelompok } = useSWR(
    session && kelompokId ? `/api/kelompok/${kelompokId}` : null,
    { onError: () => router.replace('/dashboard') }
  );
  const { data: adminData, mutate: mutateAdmin } = useSWR(
    session && kelompokId ? `/api/admin-kelompok?kelompok_id=${kelompokId}` : null
  );

  const adminList = Array.isArray(adminData) ? adminData : [];
  const loading = !adminData;

  const myPermission = adminList.find(x => x.email === session?.user?.email)?.permission || null;

  const [emailBaru, setEmailBaru] = useState('');
  const [permissionBaru, setPermissionBaru] = useState('absen');
  const [inviting, setInviting] = useState(false);
  const [pesan, setPesan] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  async function handleInvite(e) {
    e.preventDefault();
    if (!emailBaru.trim()) return;
    setInviting(true);
    setPesan(null);
    const res = await fetch('/api/admin-kelompok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, email: emailBaru.trim(), permission: permissionBaru }),
    });
    const data = await res.json();
    if (res.ok) {
      mutateAdmin(prev => (Array.isArray(prev) ? [...prev, data] : [data]), { revalidate: false });
      setEmailBaru('');
      setPesan({ type: 'ok', text: `${emailBaru} berhasil ditambahkan sebagai ${PERMISSION_INFO[permissionBaru].label}` });
    } else {
      setPesan({ type: 'err', text: `${data.error}` });
    }
    setInviting(false);
  }

  async function handleHapus(adminId) {
    if (!confirm('Hapus admin ini?')) return;
    const res = await fetch(`/api/admin-kelompok?id=${adminId}&kelompok_id=${kelompokId}`, { method: 'DELETE' });
    if (res.ok) mutateAdmin();
  }

  if (loading || !kelompok) return (
    <AppScreen>
      <div className="space-y-4 px-5 pt-8">
        <div className="h-10 w-44 animate-pulse rounded-2xl bg-muted" />
        <div className="h-28 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        <div className="h-52 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
      </div>
    </AppScreen>
  );

  const isOwner = myPermission === 'owner';

  return (
    <AppScreen>
      {/* Header */}
      <header className="px-5 pt-6">
        <button
          onClick={() => router.push(`/setup/${kelompokId}`)}
          aria-label="Kembali"
          className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
        >
          <ChevronLeft className="size-5 text-ink" />
        </button>
        <h1 className="mt-4 text-2xl font-extrabold text-ink">Kelola Admin</h1>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{kelompok?.nama_kelompok}</p>
      </header>

      {/* Info permission */}
      <section className="px-5 pt-5">
        <div className="card-soft p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-ink"><Lightbulb className="size-4 text-primary" /> Penjelasan Permission</p>
          <div className="mt-3 space-y-2">
            {Object.entries(PERMISSION_INFO).map(([key, val]) => {
              const I = val.Icon;
              return (
                <div key={key} className="flex items-center gap-2.5">
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-primary">
                    <I className="size-3" /> {val.label}
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">— {val.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Form invite — hanya owner */}
      {isOwner && (
        <section className="px-5 pt-4">
          <div className="card-soft p-4">
            <h2 className="text-base font-bold text-ink">Tambah Admin</h2>
            <form onSubmit={handleInvite} className="mt-3 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email Google Admin Baru</label>
                <input
                  type="email"
                  placeholder="contoh@gmail.com"
                  value={emailBaru}
                  onChange={e => setEmailBaru(e.target.value)}
                  required
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Permission</label>
                <select value={permissionBaru} onChange={e => setPermissionBaru(e.target.value)}
                  className="w-full appearance-none rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="absen">Pengabsen — hanya bisa absen</option>
                  <option value="viewer">Lihat Laporan — hanya lihat rekap</option>
                  <option value="owner">Owner — akses penuh</option>
                </select>
              </div>
              {pesan && (
                <div className={`rounded-2xl p-3 text-xs font-semibold ${
                  pesan.type === 'ok' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#dc2626]'
                }`}>
                  {pesan.text}
                </div>
              )}
              <button type="submit" disabled={inviting}
                className="flex w-full items-center justify-center gap-1.5 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] transition-transform active:scale-[0.99] disabled:opacity-60">
                <Plus className="size-4" /> {inviting ? 'Menambahkan...' : 'Tambah Admin'}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Daftar admin */}
      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <h2 className="text-base font-bold text-ink">Daftar Admin ({adminList.length})</h2>
          {adminList.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Belum ada admin lain.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {adminList.map(a => {
                const pInfo = PERMISSION_INFO[a.permission] || PERMISSION_INFO.viewer;
                const isMe = a.email === session?.user?.email;
                return (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                      {(() => { const I = pInfo.Icon; return <I className="size-4" />; })()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {a.email} {isMe && <span className="text-xs font-semibold text-primary">(Saya)</span>}
                      </p>
                      <span className="mt-0.5 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                        {pInfo.label}
                      </span>
                    </div>
                    {isOwner && !isMe && (
                      <button
                        onClick={() => handleHapus(a.id)}
                        className="shrink-0 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive"
                      >
                        Hapus
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </AppScreen>
  );
}
