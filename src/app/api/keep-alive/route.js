import { NextResponse } from 'next/server';
import { readSheet, SHEETS } from '@/lib/sheets';

// Route ini TIDAK dipanggil oleh user — cuma dipanggil otomatis oleh
// Vercel Cron (lihat vercel.json) supaya Supabase selalu ada aktivitas
// query dan tidak pernah kena auto-pause karena dianggap "project mati".
//
// Vercel otomatis mengisi env var CRON_SECRET begitu ada konfigurasi
// `crons` di vercel.json, dan menyertakan header
// `Authorization: Bearer <CRON_SECRET>` di setiap panggilan cron-nya.
// Kita cek header ini supaya orang lain di internet tidak bisa iseng
// memanggil endpoint ini bolak-balik.
export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Query paling ringan yang mungkin — cuma untuk "menyentuh" database,
    // skipCache supaya benar-benar sampai ke Supabase (bukan kena cache
    // di memori server).
    await readSheet(SHEETS.USERS, { skipCache: true });
    return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() });
  } catch (e) {
    // Gagal pun tetap balas 200 biar tidak dianggap "cron gagal" oleh
    // Vercel kalau cuma gangguan sesaat — yang penting request-nya sudah
    // sampai ke Supabase (itu yang dihitung sebagai aktivitas).
    return NextResponse.json({ ok: false, error: e.message });
  }
}
