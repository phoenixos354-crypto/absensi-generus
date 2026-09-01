'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Globe, MessageCircle, Coffee, ChevronLeft } from 'lucide-react';

const WA_NUMBER = '6285895970918';
const WEBSITE_URL = 'https://galipatmedia.id';
const WA_URL = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

function KopiView() {
  const [note, setNote] = useState('');

  return (
    <>
      <Coffee className="size-10 text-[#f2a900]" />
      <Dialog.Title className="mt-2 text-base font-bold text-ink">Traktir Kopi ☕</Dialog.Title>
      <Dialog.Description className="mt-1 text-sm text-ink/60">
        Scan QRIS di bawah pakai GoPay, OVO, DANA, ShopeePay, atau m-banking apa saja — nominal
        bisa langsung diisi bebas di aplikasi kamu.
      </Dialog.Description>

      <div className="mt-4 w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/traktir-kopi-qr.png"
          alt="QRIS Traktir Kopi"
          className="mx-auto w-full max-w-[240px] rounded-xl border border-black/10"
        />

        <textarea
          placeholder="Kirim masukan (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-3 w-full resize-none rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
        />
        <a
          href={WA_URL(note ? `Titip masukan: ${note}` : 'Titip masukan untuk Absensi Generus')}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-bold text-white active:scale-[0.98]"
        >
          <MessageCircle className="size-4" />
          Kirim Masukan via WhatsApp
        </a>
      </div>
    </>
  );
}

export function SupportBadge() {
  const [view, setView] = useState('info'); // 'info' | 'kopi'

  return (
    <Dialog.Root onOpenChange={(open) => !open && setView('info')}>
      {/* Badge nempel di pinggir kanan layar, fixed terus meskipun discroll */}
      <Dialog.Trigger asChild>
        <button
          aria-label="Support Us"
          className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1.5 rounded-l-2xl bg-white py-2 pl-2.5 pr-2 shadow-[var(--shadow-float)] active:scale-[0.97]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/galipatmedia-logo.png"
            alt=""
            className="size-6 shrink-0 rounded-full"
          />
          <span className="text-[10px] font-bold leading-tight text-ink">
            Support
            <br />
            Us
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-[var(--shadow-float)] focus:outline-none">
          {view === 'kopi' && (
            <button
              onClick={() => setView('info')}
              aria-label="Kembali"
              className="absolute left-3 top-3 grid size-8 place-items-center rounded-full text-ink/40 active:bg-black/5"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <Dialog.Close asChild>
            <button
              aria-label="Tutup"
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-ink/40 active:bg-black/5"
            >
              <X className="size-4" />
            </button>
          </Dialog.Close>

          <div className="flex flex-col items-center text-center">
            {view === 'info' && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/branding/galipatmedia-logo.png"
                  alt="Galipatmedia.id"
                  className="size-16 rounded-full shadow-[var(--shadow-float)]"
                />

                <Dialog.Title className="mt-4 text-base font-bold text-ink">
                  Program ini di-Support oleh Galipatmedia.id
                </Dialog.Title>
                <Dialog.Description className="mt-1.5 text-sm text-ink/60">
                  Layanan pembuatan website dan aplikasi terpercaya di Indonesia.
                </Dialog.Description>

                <div className="mt-5 flex w-full flex-col gap-2.5">
                  <button
                    onClick={() => setView('kopi')}
                    className="flex items-center justify-center gap-2 rounded-full bg-[#f2a900] py-3 text-sm font-bold text-ink active:scale-[0.98]"
                  >
                    <Coffee className="size-4" />
                    Traktir Kopi & Kirim Masukan
                  </button>
                  <a
                    href={WEBSITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]"
                  >
                    <Globe className="size-4" />
                    Kunjungi Website
                  </a>
                  <a
                    href={WA_URL('saya ingin konsultasi pembuatan website')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-bold text-white active:scale-[0.98]"
                  >
                    <MessageCircle className="size-4" />
                    Chat via WhatsApp
                  </a>
                </div>
              </>
            )}

            {view === 'kopi' && <KopiView />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
