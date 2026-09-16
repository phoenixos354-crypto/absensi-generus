'use client';
import QRCode from 'qrcode';

// Ukuran kartu KTP: 85.6 x 53.98 mm. Kanvas 2x biar tajam (1024x648).
export const KARTU_W = 1024;
export const KARTU_H = 648;

function img(src) {
  return new Promise((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = rej;
    el.src = src;
  });
}

// Gambar 1 kartu QR ke canvas. Dipakai bareng modal single + cetak massal.
export async function gambarKartuQR(canvas, { kode, namaKelompok }) {
  const ctx = canvas.getContext('2d');
  canvas.width = KARTU_W;
  canvas.height = KARTU_H;

  // Dasar putih + sudut membulat (clip)
  ctx.clearRect(0, 0, KARTU_W, KARTU_H);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, KARTU_W, KARTU_H, 48);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, KARTU_W, KARTU_H);

  // Wave biru kiri bawah
  ctx.fillStyle = '#1d5fd6';
  ctx.beginPath();
  ctx.moveTo(0, 380);
  ctx.bezierCurveTo(140, 420, 220, 520, 420, 648);
  ctx.lineTo(0, 648);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5ea3f2';
  ctx.beginPath();
  ctx.moveTo(0, 500);
  ctx.bezierCurveTo(120, 530, 240, 580, 380, 648);
  ctx.lineTo(0, 648);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.bezierCurveTo(130, 500, 230, 560, 400, 648);
  ctx.stroke();

  // Logo galipat kiri atas
  try {
    const logo = await img('/branding/galipatmedia-logo.png');
    ctx.drawImage(logo, 48, 36, 260, 78);
  } catch {}

  // Tagline kanan atas + garis vertikal biru
  ctx.fillStyle = '#2f7fe0';
  ctx.fillRect(KARTU_W - 230, 40, 7, 96);
  ctx.fillStyle = '#1f6fd0';
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('Nggayuh', KARTU_W - 205, 38);
  ctx.fillText('Marang', KARTU_W - 205, 76);
  ctx.fillText('Kasampurnan', KARTU_W - 205, 114);

  // QR tengah + bingkai biru rounded
  const qrData = await QRCode.toDataURL(String(kode), { margin: 1, width: 320 });
  const qr = await img(qrData);
  const qrS = 300;
  const qrX = KARTU_W / 2 - qrS / 2;
  const qrY = 175;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3f9bf0';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(qrX - 14, qrY - 14, qrS + 28, qrS + 28, 36);
  ctx.fill();
  ctx.stroke();
  ctx.drawImage(qr, qrX, qrY, qrS, qrS);

  // Teks bawah QR
  ctx.textAlign = 'center';
  ctx.fillStyle = '#12295e';
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillText('KARTU ABSENSI', KARTU_W / 2, qrY + qrS + 34);
  ctx.fillStyle = '#7b8aa0';
  ctx.font = '500 30px system-ui, sans-serif';
  ctx.fillText(String(namaKelompok || ''), KARTU_W / 2, qrY + qrS + 86);

  // Maskot kanan bawah
  try {
    const maskot = await img('/mascots/mascot-2.webp');
    ctx.drawImage(maskot, KARTU_W - 265, KARTU_H - 265, 245, 245);
  } catch {}

  ctx.restore();
  return canvas;
}
