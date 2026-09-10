'use client';
import { useState, useRef, useEffect } from 'react';
import { Link2, Copy, ExternalLink, Check } from 'lucide-react';

/**
 * ShareLinkButton
 * Menampilkan popup "Salin Link" dan "Kunjungi" ketika tombol diklik.
 * Props:
 *   href      – URL tujuan (string)
 *   label     – teks tombol (default: "Tampilkan di Layar")
 *   className – override class tombol utama
 */
export default function ShareLinkButton({ href, label = 'Tampilkan di Layar', className }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  // Tutup popup kalau klik di luar
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [open]);

  function getFullUrl() {
    if (typeof window === 'undefined') return href;
    return href.startsWith('http') ? href : `${window.location.origin}${href}`;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getFullUrl());
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1500);
    } catch {
      // Fallback untuk browser lama
      const ta = document.createElement('textarea');
      ta.value = getFullUrl();
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1500);
    }
  }

  const defaultClass =
    'shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/30 transition-colors';

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={className || defaultClass}
      >
        <Link2 className="size-3.5" />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/8 animate-fade-in">
          {/* URL preview */}
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="truncate text-[11px] text-gray-400">{getFullUrl()}</p>
          </div>

          {/* Salin link */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
          >
            {copied
              ? <Check className="size-4 shrink-0 text-green-500" />
              : <Copy className="size-4 shrink-0 text-gray-400" />}
            {copied ? 'Tersalin!' : 'Salin Link'}
          </button>

          {/* Kunjungi */}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="size-4 shrink-0" />
            Kunjungi
          </a>
        </div>
      )}
    </div>
  );
}
