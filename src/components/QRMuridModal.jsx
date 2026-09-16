'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Download, Printer } from 'lucide-react';
import { gambarKartuQR } from '@/lib/kartu-qr';

// Modal kartu QR satu murid: preview canvas, download PNG, cetak PDF KTP.
export function QRMuridModal({ murid, namaKelompok, onClose }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!murid) return;
    setLoading(true);
    gambarKartuQR(canvasRef.current, { kode: murid.kode_publik || murid.id, nama: murid.nama_murid, namaKelompok })
      .finally(() => setLoading(false));
  }, [murid, namaKelompok]);

  if (!murid) return null;

  function unduhPNG() {
    const a = document.createElement('a');
    a.download = `QR_${murid.nama_murid}.png`;
    a.href = canvasRef.current.toDataURL('image/png');
    a.click();
  }

  async function cetakPDF() {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: [85.6, 53.98], orientation: 'landscape' });
    doc.addImage(canvasRef.current.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 53.98);
    doc.save(`QR_${murid.nama_murid}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-ink">{murid.nama_murid}</h3>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-secondary"><X className="size-4" /></button>
        </div>
        <canvas ref={canvasRef} className="mt-4 w-full rounded-2xl shadow-[var(--shadow-card)]" />
        {loading && <p className="mt-2 text-center text-xs text-muted-foreground">Membuat kartu...</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={unduhPNG} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-secondary py-3.5 text-sm font-bold text-ink active:scale-[0.99]"><Download className="size-4" /> PNG</button>
          <button onClick={cetakPDF} className="flex flex-1 items-center justify-center gap-2 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]"><Printer className="size-4" /> Cetak</button>
        </div>
      </div>
    </div>
  );
}
