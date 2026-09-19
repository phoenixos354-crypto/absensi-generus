'use client';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';

// Kelompok yang TIDAK boleh menampilkan iklan (SplashAd)
// maupun ajakan gabung grup WA (WhatsAppGroupModal).
//
// Aturan: desa mengandung "loceret" DAN daerah mengandung "nganjuk"
// (otomatis mencakup "Nganjuk" dan "Nganjuk Barat"). Tidak peka huruf besar/kecil.
// Mau tambah desa/daerah lain? Cukup edit daftar di bawah ini.
const DESA_BEBAS = ['loceret'];
const DAERAH_BEBAS = ['nganjuk'];

const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
const mengandung = (nilai, daftar) => daftar.some((x) => norm(nilai).includes(x));

export function kelompokBebasIklan(k) {
  return mengandung(k?.desa, DESA_BEBAS) && mengandung(k?.daerah, DAERAH_BEBAS);
}

// siap    = status login & daftar kelompok sudah diketahui (jangan tampilkan
//           iklan sebelum siap, supaya tidak sempat "kedip" muncul).
// bebas   = user punya minimal satu kelompok yang masuk daftar bebas iklan.
export function useBebasIklan() {
  const { status } = useSession();
  const { data, error } = useSWR(status === 'authenticated' ? '/api/kelompok' : null);

  const siap =
    status === 'unauthenticated' ||
    (status === 'authenticated' && (Array.isArray(data) || !!error));
  const bebas = Array.isArray(data) && data.some(kelompokBebasIklan);

  return { siap, bebas };
}
