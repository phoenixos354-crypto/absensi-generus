'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Globe, MessageCircle, Coffee, ChevronLeft, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';

const WA_NUMBER = '6285895970918';
const WEBSITE_URL = 'https://galipatmedia.id';
const WA_URL = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];
const SNAP_IS_PROD = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
const SNAP_JS_SRC = SNAP_IS_PROD
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js';

function formatRupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

// Muat script Snap.js sekali saja, balikin Promise yang resolve begitu window.snap siap
function loadSnapScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.snap) return Promise.resolve(window.snap);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('midtrans-snap-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.snap));
      existing.addEventListener('error', () => reject(new Error('Gagal memuat Snap.js')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'midtrans-snap-script';
    script.src = SNAP_JS_SRC;
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '');
    script.onload = () => resolve(window.snap);
    script.onerror = () => reject(new Error('Gagal memuat Snap.js'));
    document.body.appendChild(script);
  });
}

function KopiView() {
  const [step, setStep] = useState('input'); // input | loading | waiting | success | error
  const [amount, setAmount] = useState(10000);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);

  const finalAmount = customAmount ? Number(customAmount) : amount;

  async function buatQris() {
    setErrorMsg('');
    if (!finalAmount || finalAmount < 1000) {
      setErrorMsg('Nominal minimal Rp 1.000');
      return;
    }
    setStep('loading');
    try {
      const [snap, res] = await Promise.all([
        loadSnapScript(),
        fetch('/api/traktir-kopi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: finalAmount, note }),
        }),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal bikin transaksi');

      setPaidAmount(data.gross_amount);
      setStep('waiting');

      snap.pay(data.token, {
        onSuccess: () => setStep('success'),
        onPending: () => {
          // masih nunggu pembayaran (QR sudah ditampilkan Snap), biarkan popup Snap yang urus
        },
        onError: (result) => {
          setErrorMsg(result?.status_message || 'Pembayaran gagal.');
          setStep('error');
        },
        onClose: () => {
          // user nutup popup tanpa nyelesain bayar
          setStep('input');
        },
      });
    } catch (err) {
      setErrorMsg(err.message);
      setStep('error');
    }
  }

  function ulangi() {
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
          <p className="text-sm text-ink/60">Menyiapkan QRIS...</p>
        </div>
      )}

      {step === 'waiting' && (
        <div className="mt-6 flex flex-col items-center gap-2 py-8">
          <Loader2 className="size-8 animate-spin text-[#f2a900]" />
          <p className="text-sm text-ink/60">
            Menunggu pembayaran {formatRupiah(paidAmount)} di jendela Midtrans...
          </p>
        </div>
      )}

      {step === 'success' && (
        <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2 className="size-12 text-green-500" />
          <p className="text-sm font-bold text-ink">
            Makasih traktirannya, {formatRupiah(paidAmount)}! ☕
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

      {step === 'error' && (
        <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-sm font-semibold text-ink">{errorMsg || 'Terjadi kesalahan.'}</p>
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
