'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Globe, MessageCircle } from 'lucide-react';

const WA_NUMBER = '6285895970918';
const WA_MESSAGE = 'saya ingin konsultasi pembuatan website';
const WEBSITE_URL = 'https://galipatmedia.id';
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_MESSAGE)}`;

export function SupportBadge() {
  return (
    <Dialog.Root>
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-[var(--shadow-float)] focus:outline-none">
          <Dialog.Close asChild>
            <button
              aria-label="Tutup"
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-ink/40 active:bg-black/5"
            >
              <X className="size-4" />
            </button>
          </Dialog.Close>

          <div className="flex flex-col items-center text-center">
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
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-bold text-white active:scale-[0.98]"
              >
                <MessageCircle className="size-4" />
                Chat via WhatsApp
              </a>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
