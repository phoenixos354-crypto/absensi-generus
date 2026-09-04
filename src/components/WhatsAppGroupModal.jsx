'use client';
import { useEffect, useState } from 'react';
import { X, MessageCircle, CheckCircle2 } from 'lucide-react';

// Sekali user klik "Sudah Gabung Grup WA", flag ini disimpan permanen di
// localStorage supaya modal tidak muncul lagi. Selama flag ini belum ada,
// modal akan tampil lagi setiap kali app/situs dibuka ulang (reload / tab
// baru) — klik X cuma menutup untuk sesi saat ini, bukan menutup selamanya.
const JOINED_KEY = 'ag_wa_joined';
const WA_LINK = 'https://chat.whatsapp.com/H0vZ1f13abaLcYFW46Po64';

export function WhatsAppGroupModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(JOINED_KEY)) {
      setVisible(true);
    }
  }, []);

  function handleJoinClick() {
    // Buka link WA di tab baru. Modal sengaja TIDAK ditutup di sini, karena
    // user belum tentu benar-benar sudah join — biar mereka konfirmasi lewat
    // tombol "Sudah Gabung Grup WA" setelah selesai.
    window.open(WA_LINK, '_blank', 'noopener,noreferrer');
  }

  function handleAlreadyJoined() {
    localStorage.setItem(JOINED_KEY, '1');
    setVisible(false);
  }

  function handleClose() {
    // Cuma menutup tampilan saat ini. Karena JOINED_KEY belum diset, modal
    // akan muncul lagi di kunjungan/reload berikutnya.
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-modal-title"
    >
      <div className="relative w-full max-w-[22rem] rounded-3xl bg-surface p-6 shadow-[var(--shadow-float)]">
        <button
          onClick={handleClose}
          aria-label="Tutup"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-muted-foreground active:bg-muted"
        >
          <X className="size-4" />
        </button>

        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl brand-gradient text-primary-foreground">
          <MessageCircle className="size-7" />
        </div>

        <h2 id="wa-modal-title" className="text-center text-base font-bold text-foreground">
          Gabung Grup WA Konsultasi
        </h2>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          Ada kendala pakai Absensi Generus? Mau tanya-tanya atau dapat info update terbaru? Yuk gabung grup WA konsultasi kami dulu.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            onClick={handleJoinClick}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]"
          >
            <MessageCircle className="size-4" />
            Gabung Grup WA
          </button>
          <button
            onClick={handleAlreadyJoined}
            className="flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground active:scale-[0.98]"
          >
            <CheckCircle2 className="size-4" />
            Sudah Gabung Grup WA
          </button>
        </div>
      </div>
    </div>
  );
}
