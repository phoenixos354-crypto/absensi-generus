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

// Kecilkan font otomatis biar nama panjang muat di kartu.
function fitText(ctx, teks, x, y, maxW, baseSize) {
  let size = baseSize;
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  while (ctx.measureText(teks).width > maxW && size > 20) {
    size -= 2;
    ctx.font = `800 ${size}px system-ui, sans-serif`;
  }
  ctx.fillText(teks, x, y);
}

// Gambar 1 kartu QR ke canvas. Dipakai bareng modal single + cetak massal.
export async function gambarKartuQR(canvas, { kode, nama, namaKelompok }) {
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

  // Logo galipat kiri atas (jaga rasio asli, max 270x76)
  try {
    const logo = await img('/branding/galipatmedia-logo.png');
    const lr = Math.min(270 / logo.width, 76 / logo.height);
    ctx.drawImage(logo, 48, 38, logo.width * lr, logo.height * lr);
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

  // Teks bawah QR: nama murid besar, kelompok + KARTU ABSENSI kecil
  ctx.textAlign = 'center';
  ctx.fillStyle = '#12295e';
  ctx.font = '800 40px system-ui, sans-serif';
  fitText(ctx, String(nama || ''), KARTU_W / 2, qrY + qrS + 30, 560, 40);
  ctx.fillStyle = '#7b8aa0';
  ctx.font = '500 27px system-ui, sans-serif';
  ctx.fillText(String(namaKelompok || ''), KARTU_W / 2, qrY + qrS + 76);
  ctx.fillStyle = '#12295e';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('KARTU ABSENSI', KARTU_W / 2, qrY + qrS + 108);

  // Maskot kanan bawah
  try {
    const maskot = await img('/mascots/mascot-2.webp');
    ctx.drawImage(maskot, KARTU_W - 265, KARTU_H - 265, 245, 245);
  } catch {}

  ctx.restore();
  return canvas;
}
