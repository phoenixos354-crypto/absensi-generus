'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Copy, ExternalLink, Check } from 'lucide-react';

/**
 * ShareLinkButton
 * Popup di-render via React Portal langsung ke document.body,
 * sehingga tidak terpengaruh overflow/stacking context parent manapun.
 */
export default function ShareLinkButton({ href, label = 'Tampilkan di Layar', className }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef(null);

  // Pastikan portal hanya dirender di client
  useEffect(() => { setMounted(true); }, []);

  // Hitung posisi popup berdasarkan posisi tombol
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const popupW = 224;
    let left = rect.right - popupW;
    if (left < 8) left = rect.left;
    if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
    setPopupStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: Math.max(8, left),
      width: popupW,
      zIndex: 99999,
    });
  }, [open]);

  // Tutup popup kalau klik di luar
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
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
    } catch {
      const ta = document.createElement('textarea');
      ta.value = getFullUrl();
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  }

  const defaultClass =
    'shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/30 transition-colors';

  const popup = (
    <div
      style={popupStyle}
      className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
    >
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
  );

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={className || defaultClass}
      >
        <Link2 className="size-3.5" />
        {label}
      </button>

      {/* Portal ke body agar bebas dari overflow/stacking context parent */}
      {mounted && open && createPortal(popup, document.body)}
    </div>
  );
}
