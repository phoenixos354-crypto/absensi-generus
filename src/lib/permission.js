import { readSheet, SHEETS } from './sheets';

/**
 * Normalisasi email untuk perbandingan & penyimpanan:
 * trim + lowercase. Mencegah bug "sudah diinvite tapi tidak muncul"
 * gara-gara beda kapital (mis. Admin@Gmail.com vs admin@gmail.com)
 * atau spasi nyasar.
 */
export function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Cek apakah user punya akses ke kelompok tertentu
 * Return: 'owner' | 'absen' | 'viewer' | null
 */
export async function getPermission(userEmail, kelompokId) {
  const email = normEmail(userEmail);
  const [kelompokList, adminList] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.ADMIN_KELOMPOK),
  ]);

  // Cek apakah dia owner (pembuat kelompok)
  const kelompok = kelompokList.find(k => k.id === kelompokId);
  if (!kelompok) return null;

  // Cek di tabel users apakah dia owner
  const users = await readSheet(SHEETS.USERS);
  const user = users.find(u => normEmail(u.email) === email);
  if (kelompok.user_id === user?.id) return 'owner';

  // Cek di admin_kelompok
  const adminEntry = adminList.find(a => a.kelompok_id === kelompokId && normEmail(a.email) === email);
  if (adminEntry) return adminEntry.permission;

  return null;
}

/**
 * Ambil semua kelompok yang bisa diakses user
 * (milik sendiri + yang diinvite)
 */
export async function getKelompokAkses(userEmail, userId) {
  const email = normEmail(userEmail);
  const [kelompokList, adminList] = await Promise.all([
    readSheet(SHEETS.KELOMPOK),
    readSheet(SHEETS.ADMIN_KELOMPOK),
  ]);

  // Kelompok milik sendiri
  const milik = kelompokList
    .filter(k => k.user_id === userId)
    .map(k => ({ ...k, permission: 'owner' }));

  // Kelompok yang diinvite
  const diinvite = adminList
    .filter(a => normEmail(a.email) === email)
    .map(a => {
      const k = kelompokList.find(k => k.id === a.kelompok_id);
      return k ? { ...k, permission: a.permission } : null;
    })
    .filter(Boolean);

  // Gabungkan, hindari duplikat
  const idMilik = new Set(milik.map(k => k.id));
  const all = [...milik, ...diinvite.filter(k => !idMilik.has(k.id))];
  return all;
}
