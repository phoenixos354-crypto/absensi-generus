'use client';
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import QRCode from 'qrcode';
import { X, Globe, MessageCircle, Coffee, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react';

const WA_NUMBER = '6285895970918';
const WA_MESSAGE = 'saya ingin konsultasi pembuatan website';
const WEBSITE_URL = 'https://galipatmedia.id';
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_MESSAGE)}`;

const NOMINAL_CEPAT = [5000, 10000, 25000, 50000];

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
}

function KopiForm({ onCreated }) {
  const [amount, setAmount] = useState(10000);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const finalAmount = customAmount ? Number(customAmount) : amount;

  async function handleSubmit() {
    setError('');
    if (!Number.isFinite(finalAmount) || finalAmount < 1000) {
      setError('Nominal minimal Rp1.000');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/traktir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalAmount, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat QRIS');
      onCreated({ ...data, amount: finalAmount });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 w-full">
      <p className="text-xs font-bold text-ink/70">Pilih nominal</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {NOMINAL_CEPAT.map((n) => (
          <button
            key={n}
            onClick={() => { setAmount(n); setCustomAmount(''); }}
            className={`rounded-xl py-2 text-xs font-bold transition-colors ${
              !customAmount && amount === n ? 'bg-ink text-primary-foreground' : 'bg-black/5 text-ink'
            }`}
          >
            {n / 1000}rb
          </button>
        ))}
      </div>

      <input
        type="number"
        inputMode="numeric"
        min={1000}
        placeholder="Atau isi nominal bebas (Rp)"
        value={customAmount}
        onChange={(e) => setCustomAmount(e.target.value)}
        className="mt-2.5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
      />

      <textarea
        placeholder="Kirim masukan (opsional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="mt-2.5 w-full resize-none rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-ink/30"
      />

      {error && <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#f2a900] py-3 text-sm font-bold text-ink active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Coffee className="size-4" />}
        {loading ? 'Menyiapkan QRIS...' : `Bayar ${formatRupiah(finalAmount)} via QRIS`}
      </button>
    </div>
  );
}

function KopiQr({ data, onReset }) {
  const [status, setStatus] = useState(data.transaction_status || 'pending');
  const [qrImage, setQrImage] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (data.qr_string) {
      QRCode.toDataURL(data.qr_string, { width: 320, margin: 1 })
        .then((url) => { if (!cancelled) setQrImage(url); })
        .catch(() => { if (!cancelled) setQrImage(null); });
    } else if (data.qr_url) {
      setQrImage(data.qr_url);
    }
    return () => { cancelled = true; };
  }, [data.qr_string, data.qr_url]);

  useEffect(() => {
    if (!data.order_id || status === 'settlement' || status === 'capture') return;

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/traktir/status?order_id=${encodeURIComponent(data.order_id)}`);
        const json = await res.json();
        if (json.transaction_status) setStatus(json.transaction_status);
      } catch {
        // diamkan, coba lagi di interval berikutnya
      }
    }, 3000);

    return () => clearInterval(intervalRef.current);
  }, [data.order_id, status]);

  const isPaid = status === 'settlement' || status === 'capture';
  const isDead = status === 'expire' || status === 'cancel' || status === 'deny';

  if (isPaid) {
    return (
      <div className="mt-4 flex w-full flex-col items-center gap-2 py-4 text-center">
        <CheckCircle2 className="size-14 text-green-500" />
        <p className="text-sm font-bold text-ink">Terima kasih atas traktirannya! ☕</p>
        <p className="text-xs text-ink/60">Pembayaran {formatRupiah(data.amount)} sudah diterima.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex w-full flex-col items-center gap-2">
      {qrImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrImage} alt="QRIS" className="size-56 rounded-xl border border-black/10" />
      ) : (
        <div className="flex size-56 items-center justify-center rounded-xl border border-black/10">
          <Loader2 className="size-6 animate-spin text-ink/40" />
        </div>
      )}
      <p className="text-sm font-bold text-ink">{formatRupiah(data.amount)}</p>

      {isDead ? (
        <>
          <p className="text-xs font-semibold text-red-500">QR kedaluwarsa / dibatalkan</p>
          <button onClick={onReset} className="mt-1 text-xs font-bold text-ink underline">
            Coba lagi
          </button>
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-ink/60">
          <Loader2 className="size-3.5 animate-spin" /> Menunggu pembayaran...
        </p>
      )}
    </div>
  );
}

export function SupportBadge() {
  const [view, setView] = useState('info'); // 'info' | 'kopi'
  const [qrData, setQrData] = useState(null);

  function reset() {
    setView('info');
    setQrData(null);
  }

  return (
    <Dialog.Root onOpenChange={(open) => !open && reset()}>
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
          {view === 'kopi' && !qrData && (
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
                    href={WA_URL}
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

            {view === 'kopi' && (
              <>
                <Coffee className="size-10 text-[#f2a900]" />
                <Dialog.Title className="mt-2 text-base font-bold text-ink">Traktir Kopi ☕</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-ink/60">
                  Scan QRIS untuk traktir kopi developer, sekalian kirim masukan kalau ada.
                </Dialog.Description>

                {qrData ? (
                  <KopiQr data={qrData} onReset={() => setQrData(null)} />
                ) : (
                  <KopiForm onCreated={setQrData} />
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
