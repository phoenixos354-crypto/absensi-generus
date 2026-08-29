// =============================================
// LOCAL-FIRST OVERLAY untuk nilai target progress
// =============================================
// Ide: begitu user pilih nilai, tulis LANGSUNG ke localStorage (bukan cuma
// cache SWR di memori). Ini penting karena cache SWR hilang kalau tab
// direload / app ditutup, sedangkan localStorage tetap ada.
//
// Alur:
// 1. pilihNilai() -> tulis ke localStorage + optimistic mutate (UI langsung berubah)
// 2. Kirim POST ke server di background (tidak diawait oleh UI)
// 3. Kalau sukses -> hapus dari localStorage (server sudah settle)
// 4. Kalau gagal/lambat -> TETAP tersimpan di localStorage, dicoba lagi nanti
//    (saat halaman dibuka lagi / flushPending dipanggil), TIDAK di-rollback
// 5. Setiap kali progress dibaca untuk ditampilkan, hasil dari server ditimpa
//    dulu dengan overlay ini -> UI selalu nunjukin nilai TERAKHIR yang
//    dipilih user, walau server belum tentu sudah selesai nulis.

const KEY_PREFIX = 'ag_pending_progress_';

function keyFor(muridId) {
  return `${KEY_PREFIX}${muridId}`;
}

export function getPendingOverlay(muridId) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(keyFor(muridId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Simpan 1 perubahan nilai ke localStorage (dipanggil SEBELUM fetch ke server)
export function setPendingValue(muridId, itemId, nilai) {
  if (typeof window === 'undefined') return;
  const overlay = getPendingOverlay(muridId);
  overlay[itemId] = { nilai, ts: Date.now(), attempts: 0 };
  localStorage.setItem(keyFor(muridId), JSON.stringify(overlay));
}

// Hapus 1 entry setelah server konfirmasi sukses
export function clearPendingValue(muridId, itemId) {
  if (typeof window === 'undefined') return;
  const overlay = getPendingOverlay(muridId);
  delete overlay[itemId];
  if (Object.keys(overlay).length === 0) {
    localStorage.removeItem(keyFor(muridId));
  } else {
    localStorage.setItem(keyFor(muridId), JSON.stringify(overlay));
  }
}

// Timpa data dari server dengan nilai-nilai yang masih "pending" di lokal,
// supaya tampilan selalu nunjukin pilihan terakhir user walau server belum
// tentu sudah nyimpen / walau habis reload halaman.
export function mergeOverlay(progressList, muridId) {
  const overlay = getPendingOverlay(muridId);
  const pendingIds = Object.keys(overlay);
  if (pendingIds.length === 0) return progressList || [];

  const hasil = [...(progressList || [])];
  for (const itemId of pendingIds) {
    const nilai = overlay[itemId].nilai;
    const idx = hasil.findIndex(p => p.item_id === itemId);
    if (idx >= 0) hasil[idx] = { ...hasil[idx], nilai };
    else hasil.push({ item_id: itemId, nilai });
  }
  return hasil;
}

// Kirim 1 nilai ke server, dengan retry ringan kalau gagal (bukan di-drop).
// Dipanggil "fire and forget" dari komponen — tidak perlu di-await oleh UI.
async function kirimKeServer(muridId, itemId, nilai, percobaanKe = 0) {
  try {
    const res = await fetch('/api/target-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ murid_id: muridId, item_id: itemId, nilai }),
    });
    if (!res.ok) throw new Error('Gagal simpan ke server');

    // Kalau selagi nunggu, user sudah ganti lagi nilainya (lebih baru
    // dari yang baru saja kita kirim) -> jangan hapus dari pending,
    // biarkan pengiriman nilai TERBARU yang menang.
    const overlay = getPendingOverlay(muridId);
    if (overlay[itemId]?.nilai === nilai) {
      clearPendingValue(muridId, itemId);
    }
    return true;
  } catch (err) {
    // Gagal (offline / server lambat / error) -> jangan dihapus dari
    // localStorage, tetap dianggap "pending" dan akan dicoba lagi.
    const overlay = getPendingOverlay(muridId);
    if (overlay[itemId]) {
      overlay[itemId].attempts = (overlay[itemId].attempts || 0) + 1;
      localStorage.setItem(keyFor(muridId), JSON.stringify(overlay));
    }
    // Retry otomatis maksimal beberapa kali dengan jeda membesar,
    // supaya kalau cuma telat sebentar (jaringan lemot) tetap ke-sync
    // tanpa perlu user buka ulang halaman.
    if (percobaanKe < 4) {
      const jeda = Math.min(2000 * (percobaanKe + 1), 8000);
      setTimeout(() => kirimKeServer(muridId, itemId, nilai, percobaanKe + 1), jeda);
    }
    return false;
  }
}

// Pilih nilai: simpan lokal dulu (instan), lalu kirim ke server di background.
// TIDAK menunggu (tidak di-await oleh pemanggil) — UI tidak pernah nge-block.
export function pilihNilaiLocalFirst(muridId, itemId, nilai) {
  setPendingValue(muridId, itemId, nilai);
  kirimKeServer(muridId, itemId, nilai); // sengaja tidak di-await
}

// Dipanggil saat halaman dibuka — coba kirim ulang semua yang masih
// "pending" dari sesi sebelumnya (misal: tadi ditutup sebelum sempat sync).
export function flushPending(muridId) {
  const overlay = getPendingOverlay(muridId);
  for (const itemId of Object.keys(overlay)) {
    kirimKeServer(muridId, itemId, overlay[itemId].nilai);
  }
}
