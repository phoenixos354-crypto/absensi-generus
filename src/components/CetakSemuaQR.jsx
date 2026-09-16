'use client';
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { gambarKartuQR, KARTU_W, KARTU_H } from '@/lib/kartu-qr';

// Tombol "Cetak Semua QR": 1 PDF A4, 10 kartu/halaman (2x5), garis potong.
export function CetakSemuaQR({ muridList, namaKelompok }) {
  const [loading, setLoading] = useState(false);

  async function handleCetak() {
    if (!muridList?.length) return;
    setLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const kartuW = 85.6;
      const kartuH = 53.98;
      const offX = (210 - kartuW * 2) / 2;
      let pertama = true;

      for (let i = 0; i < muridList.length; i += 10) {
        if (!pertama) doc.addPage();
        pertama = false;
        const batch = muridList.slice(i, i + 10);
        for (let j = 0; j < batch.length; j++) {
          const m = batch[j];
          const col = j % 2;
          const row = Math.floor(j / 2);
          const x = offX + col * kartuW;
          const y = 8 + row * kartuH;
          const canvas = document.createElement('canvas');
          await gambarKartuQR(canvas, { kode: m.kode_publik || m.id, namaKelompok });
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, kartuW, kartuH);
          doc.setDrawColor(150, 150, 150);
          doc.setLineDashPattern([1.5, 1.5], 0);
          doc.rect(x, y, kartuW, kartuH);
          doc.setLineDashPattern([], 0);
        }
      }
      doc.save(`Kartu_QR_${String(namaKelompok || 'kelompok').replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      alert('Gagal membuat PDF. Coba lagi.');
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleCetak}
      disabled={loading || !muridList?.length}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-secondary py-3.5 text-sm font-bold text-ink active:scale-[0.99] disabled:opacity-60"
    >
      <Printer className="size-4" />
      {loading ? 'Membuat PDF...' : `Cetak Semua QR (${muridList?.length || 0} murid)`}
    </button>
  );
}
