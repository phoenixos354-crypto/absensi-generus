'use client';
import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Globe, MessageCircle, Coffee, ChevronLeft, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';

const WA_NUMBER = '6285895970918';
const WEBSITE_URL = 'https://galipatmedia.id';
const WA_URL = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];
const EXPIRY_SECONDS = 15 * 60; // samain dengan custom_expiry di API route

function formatRupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function mmss(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function KopiView() {
  const [step, setStep] = useState('input'); // input | loading | qr | success | error | expired
  const [amount, setAmount] = useState(10000);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [qr, setQr] = useState(null); // { order_id, qr_url, gross_amount }
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const finalAmount = customAmount ? Number(customAmount) : amount;

  useEffect(() => {
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  async function buatQris() {
    setErrorMsg('');
    if (!finalAmount || finalAmount < 1000) {
      setErrorMsg('Nominal minimal Rp 1.000');
      return;
    }
    setStep('loading');
    try {
      const res = await fetch('/api/traktir-kopi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalAmount, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal bikin QRIS');

      setQr(data);
      setSecondsLeft(EXPIRY_SECONDS);
      setStep('qr');
      mulaiPolling(data.order_id);
      mulaiCountdown();
    } catch (err) {
      setErrorMsg(err.message);
      setStep('error');
    }
  }

  function mulaiCountdown() {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          clearInterval(pollRef.current);
          setStep('expired');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function mulaiPolling(order_id) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/traktir-kopi?order_id=${order_id}`);
        const data = await res.json();
        if (data.transaction_status === 'settlement' || data.transaction_status === 'capture') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStep('success');
        } else if (['expire', 'cancel', 'deny'].includes(data.transaction_status)) {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStep('expired');
        }
      } catch {
        // koneksi gagal, coba lagi di polling berikutnya
      }
    }, 4000);
  }

  function ulangi() {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setQr(null);
    setErrorMsg('');
    setStep('input');
  }

  return (
    <>
      <Coffee className="size-10 text-[#f2a900]" />
      <Dialog.Title className="mt-2 text-base font-bold text-ink">Traktir Kopi ☕</Dialog.Title>

      {step === 'input' && (
        <>
          <Dialog.Description className="mt-1 text-sm text-ink/60">
            Pilih atau isi nominal, nanti QRIS-nya langsung muncul sesuai nominal itu.
          </Dialog.Description>

          <div className="mt-4 w-full">
            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAmount(a);
                    setCustomAmount('');
                  }}
                  className={`rounded-xl border py-2 text-xs font-bold active:scale-[0.97] ${
                    !customAmount && amount === a
                      ? 'border-[#f2a900] bg-[#f2a900]/10 text-ink'
                      : 'border-black/10 text-ink/60'
                  }`}
                >
                  {(a / 1000).toFixed(0)}rb
                </button>
              ))}
            </div>

            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-black/10 px-3.5 py-2.5">
              <span className="text-sm font-bold text-ink/40">Rp</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Nominal lain"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full text-sm text-ink outline-none"
              />
            </div>

            <textarea
              placeholder="Kirim masukan (opsional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-2.5 w-full resize-none rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
            />

            {errorMsg && <p className="mt-2 text-xs font-semibold text-red-500">{errorMsg}</p>}

            <button
              onClick={buatQris}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#f2a900] py-3 text-sm font-bold text-ink active:scale-[0.98]"
            >
              <Coffee className="size-4" />
              Buat QRIS {formatRupiah(finalAmount)}
            </button>

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
      )}

      {step === 'loading' && (
        <div className="mt-6 flex flex-col items-center gap-2 py-8">
          <Loader2 className="size-8 animate-spin text-[#f2a900]" />
          <p className="text-sm text-ink/60">Membuat QRIS...</p>
        </div>
      )}

      {step === 'qr' && qr && (
        <div className="mt-3 w-full">
          <Dialog.Description className="text-sm text-ink/60">
            Scan pakai GoPay, OVO, DANA, ShopeePay, atau m-banking apa saja.
          </Dialog.Description>

          <p className="mt-2 text-lg font-extrabold text-ink">{formatRupiah(qr.gross_amount)}</p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr.qr_url}
            alt="QRIS Traktir Kopi"
            className="mx-auto mt-2 w-full max-w-[240px] rounded-xl border border-black/10"
          />

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-ink/50">
            <Loader2 className="size-3.5 animate-spin" />
            Menunggu pembayaran... berlaku {mmss(secondsLeft)} lagi
          </div>

          <button
            onClick={ulangi}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-black/10 py-2.5 text-sm font-semibold text-ink/60 active:scale-[0.98]"
          >
            <RefreshCw className="size-3.5" />
            Ganti Nominal
          </button>
        </div>
      )}

      {step === 'success' && (
        <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2 className="size-12 text-green-500" />
          <p className="text-sm font-bold text-ink">
            Makasih traktirannya, {formatRupiah(qr?.gross_amount)}! ☕
          </p>
          <p className="text-xs text-ink/50">Developer kamu happy hari ini.</p>
          <button
            onClick={ulangi}
            className="mt-2 rounded-full bg-[#f2a900] px-5 py-2.5 text-sm font-bold text-ink active:scale-[0.98]"
          >
            Traktir Lagi
          </button>
        </div>
      )}

      {(step === 'expired' || step === 'error') && (
        <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-sm font-semibold text-ink">
            {step === 'expired' ? 'QRIS sudah kedaluwarsa.' : errorMsg || 'Terjadi kesalahan.'}
          </p>
          <button
            onClick={ulangi}
            className="mt-2 flex items-center gap-2 rounded-full bg-[#f2a900] px-5 py-2.5 text-sm font-bold text-ink active:scale-[0.98]"
          >
            <RefreshCw className="size-3.5" />
            Coba Lagi
          </button>
        </div>
      )}
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
