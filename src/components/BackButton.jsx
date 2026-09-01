'use client';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

// Tombol "kembali" yang PRIORITASKAN browser history.back() (bukan
// router.push ke URL tetap kayak sebelumnya). Alasannya:
//
// 1. Next.js otomatis me-restore posisi scroll halaman sebelumnya kalau
//    navigasinya lewat back/forward (popstate) — tapi TIDAK kalau lewat
//    push. Jadi selama tombol "kembali" pakai push, halaman sebelumnya
//    selalu ke-reset scroll-nya ke atas. Pakai back() memperbaiki ini.
// 2. Supaya riwayat navigasi konsisten dengan tombol back fisik/gesture di
//    HP: "kembali" beneran mundur satu langkah (pop), bukan numpuk entry
//    baru di history (push) yang bikin alur back jadi berantakan kalau
//    dipencet berkali-kali.
//
// Fallback ke router.push(fallbackHref) dipakai kalau halaman ini dibuka
// langsung (deep link / reload / dibuka dari luar app) sehingga belum ada
// riwayat in-app buat di-"back"-in — dideteksi lewat panjang history saat
// pertama kali app dibuka, yang dicatat oleh <TrackEntryHistory> di
// Providers.js.
export function BackButton({ fallbackHref, className, iconClassName = 'size-5 text-ink', ariaLabel = 'Kembali' }) {
  const router = useRouter();

  function handleBack() {
    const entryLen = Number(sessionStorage.getItem('ag_entry_history_len') || 0);
    if (typeof window !== 'undefined' && window.history.length > entryLen) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button onClick={handleBack} aria-label={ariaLabel} className={className}>
      <ChevronLeft className={iconClassName} />
    </button>
  );
}
