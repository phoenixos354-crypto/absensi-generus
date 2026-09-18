'use client';
import { useState } from 'react';
import { FileDown } from 'lucide-react';

export function ExportPDF({ kelompok, rekap, periode }) {
  const [loading, setLoading] = useState(false);

  // Format tanggal aman: tanggal rusak/kosong tidak boleh meledakkan PDF
  function formatTanggalID(tgl, opts) {
    const d = new Date(tgl);
    if (!tgl || isNaN(d)) return '-';
    try {
      return d.toLocaleDateString('id-ID', opts);
    } catch {
      return '-';
    }
  }

  async function handleExport() {
    setLoading(true);
    try {
      const kelompokAman = kelompok || {};
      const rekapAman = rekap || {};
      const periodeAman = String(periode || 'Rekap');
      // Dynamic import jsPDF agar tidak memperbesar bundle
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const margin = 15;
      const pageW = 210;
      const contentW = pageW - margin * 2;
      let y = margin;

      // ===== HEADER =====
      doc.setFillColor(26, 107, 60);
      doc.rect(0, 0, pageW, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN ABSENSI GENERUS', pageW / 2, 12, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(String(kelompokAman.nama_kelompok || 'Kelompok'), pageW / 2, 20, { align: 'center' });
      doc.text(`${kelompokAman.desa || '-'} · ${kelompokAman.daerah || '-'}`, pageW / 2, 27, { align: 'center' });

      y = 40;
      doc.setTextColor(0, 0, 0);

      // ===== INFO KELOMPOK =====
      doc.setFillColor(232, 245, 238);
      doc.rect(margin, y, contentW, 22, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Tingkatan:', margin + 3, y + 6);
      doc.text('Periode:', margin + 3, y + 12);
      doc.text('Total Sesi:', margin + 3, y + 18);
      doc.setFont('helvetica', 'normal');
      doc.text(String(kelompokAman.tingkatan || '-').toUpperCase(), margin + 30, y + 6);
      doc.text(periodeAman, margin + 30, y + 12);
      doc.text(`${rekapAman.total_sesi || 0} sesi ngaji`, margin + 30, y + 18);

      // Kehadiran global di kanan
      const persen = Number(rekapAman.persen_global) || 0;
      const warnaP = persen >= 80 ? [22,163,74] : persen >= 60 ? [202,138,4] : [220,38,38];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...warnaP);
      doc.text(`${persen}%`, pageW - margin - 3, y + 14, { align: 'right' });
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Kehadiran Global', pageW - margin - 3, y + 19, { align: 'right' });

      y += 28;
      doc.setTextColor(0, 0, 0);

      // ===== RINGKASAN INFAQ =====
      const totalInfaq = Number(rekapAman.total_infaq) || 0;
      const totalPengeluaran = Number(rekapAman.total_pengeluaran) || 0;
      const sisaInfaq = Number(rekapAman.sisa_infaq) || 0;

      if (totalInfaq > 0 || totalPengeluaran > 0) {
        doc.setFillColor(254, 249, 195);
        doc.rect(margin, y, contentW, 24, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Ringkasan Infaq', margin + 3, y + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('Infaq Masuk:', margin + 3, y + 12);
        doc.text(`Rp${totalInfaq.toLocaleString('id-ID')}`, margin + 45, y + 12);
        doc.setTextColor(220, 38, 38);
        doc.text('Pengeluaran:', margin + 3, y + 17);
        doc.text(`Rp${totalPengeluaran.toLocaleString('id-ID')}`, margin + 45, y + 17);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('Sisa Infaq:', margin + 3, y + 22);
        doc.setTextColor(sisaInfaq < 0 ? [220,38,38] : [22,163,74]);
        doc.text(`Rp${sisaInfaq.toLocaleString('id-ID')}`, margin + 45, y + 22);
        doc.setTextColor(0, 0, 0);
        y += 28;
      }

      // ===== TABEL REKAP PER MURID =====
      const sorted = [...(rekapAman.rekap_murid || [])].sort((a, b) => (Number(b.persen_hadir) || 0) - (Number(a.persen_hadir) || 0));

      // Header tabel
      const cols = [
        { label: 'No',     w: 10, align: 'center' },
        { label: 'Nama Murid', w: 60, align: 'left' },
        { label: 'Hadir', w: 18, align: 'center' },
        { label: 'Izin',  w: 18, align: 'center' },
        { label: 'Sakit', w: 18, align: 'center' },
        { label: 'Alfa',  w: 18, align: 'center' },
        { label: 'Total', w: 18, align: 'center' },
        { label: '%',     w: 20, align: 'center' },
      ];

      // Header row
      doc.setFillColor(26, 107, 60);
      doc.rect(margin, y, contentW, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      let x = margin;
      cols.forEach(col => {
        const tx = col.align === 'center' ? x + col.w / 2 : x + 2;
        doc.text(col.label, tx, y + 5.5, { align: col.align === 'center' ? 'center' : 'left' });
        x += col.w;
      });
      y += 8;

      // Data rows
      doc.setFont('helvetica', 'normal');
      sorted.forEach((m, i) => {
        // Cegah overflow halaman
        if (y > 270) {
          doc.addPage();
          y = margin;
        }

        const rowH = 7;
        const bg = i % 2 === 0 ? [248, 252, 249] : [255, 255, 255];
        doc.setFillColor(...bg);
        doc.rect(margin, y, contentW, rowH, 'F');

        // Warna persen
        const persenMurid = Number(m.persen_hadir) || 0;
        const wp = persenMurid >= 80 ? [22,163,74] : persenMurid >= 60 ? [202,138,4] : [220,38,38];

        doc.setTextColor(0, 0, 0);
        const rowData = [i+1, m.nama || '-', m.hadir || 0, m.izin || 0, m.sakit || 0, m.alfa || 0, m.total || 0, `${persenMurid}%`];
        x = margin;
        cols.forEach((col, ci) => {
          if (ci === 7) doc.setTextColor(...wp);
          else doc.setTextColor(0, 0, 0);
          const val = String(rowData[ci]);
          const tx = col.align === 'center' ? x + col.w / 2 : x + 2;
          doc.text(val, tx, y + 4.8, { align: col.align === 'center' ? 'center' : 'left' });
          x += col.w;
        });

        // Garis bawah
        doc.setDrawColor(212, 232, 219);
        doc.line(margin, y + rowH, margin + contentW, y + rowH);
        y += rowH;
      });

      // ===== RINCIAN PENGELUARAN INFAQ =====
      if (rekapAman.daftar_pengeluaran?.length > 0) {
        if (y > 240) { doc.addPage(); y = margin; }
        y += 4;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Rincian Pengeluaran Infaq', margin, y + 5);
        y += 8;

        const cols2 = [
          { label: 'No', w: 10, align: 'center' },
          { label: 'Tanggal', w: 35, align: 'left' },
          { label: 'Keterangan', w: 75, align: 'left' },
          { label: 'Jumlah', w: 30, align: 'right' },
        ];

        // Header row
        doc.setFillColor(220, 38, 38);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        let x2 = margin;
        cols2.forEach(col => {
          const tx = col.align === 'center' ? x2 + col.w/2 : col.align === 'right' ? x2 + col.w - 2 : x2 + 2;
          doc.text(col.label, tx, y + 4.8, { align: col.align === 'center' ? 'center' : col.align === 'right' ? 'right' : 'left' });
          x2 += col.w;
        });
        y += 7;

        // Data rows
        doc.setFont('helvetica', 'normal');
        rekap.daftar_pengeluaran.forEach((p, i) => {
          if (y > 270) { doc.addPage(); y = margin; }
          const rowH = 6;
          const bg = i % 2 === 0 ? [254,249,195] : [255,255,255];
          doc.setFillColor(...bg);
          doc.rect(margin, y, contentW, rowH, 'F');
          doc.setTextColor(0, 0, 0);
          const tgl = formatTanggalID(p.tanggal, { day:'numeric', month:'short', year:'numeric' });
          const rowData = [i+1, tgl, p.keterangan || '-', `Rp${(Number(p.jumlah) || 0).toLocaleString('id-ID')}`];
          x2 = margin;
          cols2.forEach((col, ci) => {
            const tx = col.align === 'center' ? x2 + col.w/2 : col.align === 'right' ? x2 + col.w - 2 : x2 + 2;
            doc.text(String(rowData[ci]), tx, y + 4.3, { align: col.align === 'center' ? 'center' : col.align === 'right' ? 'right' : 'left' });
            x2 += col.w;
          });
          doc.setDrawColor(212, 232, 219);
          doc.line(margin, y + rowH, margin + contentW, y + rowH);
          y += rowH;
        });
        y += 6;
      }

      // ===== FOOTER =====
      y += 8;
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      const tglCetak = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
      doc.text(`Dicetak: ${tglCetak} · Absensi Generus`, margin, y);
      doc.text(`Halaman 1`, pageW - margin, y, { align: 'right' });

      // Garis footer
      doc.setDrawColor(26, 107, 60);
      doc.line(margin, y - 3, pageW - margin, y - 3);

      // Save
      const namaAman = String(kelompokAman.nama_kelompok || 'Kelompok').replace(/\s+/g,'_');
      const fileName = `Rekap_${namaAman}_${periodeAman.replace(/\s+/g,'_')}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Gagal generate PDF. Coba lagi.');
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-full brand-gradient py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-float)] transition-transform active:scale-[0.99] disabled:opacity-60"
    >
      <FileDown className="size-5" />
      {loading ? 'Membuat PDF...' : 'Export PDF'}
    </button>
  );
}
