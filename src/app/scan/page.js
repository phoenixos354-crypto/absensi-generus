'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AppScreen } from '@/components/AppScreen';
import { BackButton } from '@/components/BackButton';
import { ScanLine, CheckCircle2, AlertTriangle, Keyboard, SwitchCamera } from 'lucide-react';

function bunyiTit() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.2;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.2);
  } catch {}
  try { navigator.vibrate?.(80); } catch {}
}

export default function ScanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [kelompokList, setKelompokList] = useState([]);
  const [kelompokId, setKelompokId] = useState('');
  const [tanggal, setTanggal] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [flash, setFlash] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [riwayat, setRiwayat] = useState([]);
  const [pesan, setPesan] = useState(null);
  const [kodeManual, setKodeManual] = useState('');
  const [loadingKirim, setLoadingKirim] = useState(false);
  const [kameraDepan, setKameraDepan] = useState(false);
  const [sudahScan, setSudahScan] = useState(new Set());
  const scannerRef = useRef(null);
  const kirimLock = useRef(false);
  const jedaRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (session) fetch('/api/kelompok').then(r => r.json()).then(d => {
      const seen = new Set();
      const list = Array.isArray(d) ? d.filter(k => {
        if (k.permission !== 'owner' && k.permission !== 'absen') return false;
        if (seen.has(k.id)) return false;
        seen.add(k.id);
        return true;
      }) : [];
      setKelompokList(list);
      if (list.length === 1) setKelompokId(list[0].id);
    }).catch(() => {});
  }, [session]);

  useEffect(() => () => hentikan(), []);

  async function kirimKode(kode) {
    const k = String(kode || '').trim();
    if (!k || !kelompokId) return;
    if (kirimLock.current) return;
    if (sudahScan.has(`${kelompokId}|${tanggal}|${k}`)) return;
    kirimLock.current = true;
    setLoadingKirim(true);
    // Jeda 2.5 detik biar 1 QR cuma kehitung sekali walau masih di depan kamera
    clearTimeout(jedaRef.current);
    jedaRef.current = setTimeout(() => { kirimLock.current = false; }, 2500);
    try {
      const n = new Date();
      const jamLokal = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
      const res = await fetch('/api/absensi/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode_publik: k, kelompok_id: kelompokId, tanggal, jam_datang: jamLokal }),
      });
      const data = await res.json();
      if (res.ok) {
        const kunci = data.murid_id || data.nama;
        // Flash hijau overlay 600ms tiap sukses — kelihatan walau HP silau
        setFlash({ nama: data.nama, jam: data.jam_datang, kunci: Date.now() });
        setTimeout(() => setFlash(null), 900);
        if (data.sudah) {
          setPesan({ tipe: 'error', teks: `${data.nama} sudah discan ${data.jam_datang}` });
        } else {
          bunyiTit();
          setSudahScan(prev => new Set(prev).add(`${kelompokId}|${tanggal}|${k}`));
          setPesan({ tipe: 'sukses', teks: `${data.nama} — Hadir ${data.jam_datang}` });
        }
        // 1 murid = 1 baris riwayat (update, bukan numpuk)
        setRiwayat(prev => [{ kunci, nama: data.nama, jam: data.jam_datang, ok: true, waktu: new Date().toLocaleTimeString('id-ID') }, ...prev.filter(r => r.kunci !== kunci)].slice(0, 30));
      } else {
        const kunci = `gagal|${k}`;
        setRiwayat(prev => [{ kunci, nama: k, jam: '', ok: false, waktu: new Date().toLocaleTimeString('id-ID') }, ...prev.filter(r => r.kunci !== kunci)].slice(0, 30));
        setPesan({ tipe: 'error', teks: data.error || 'Gagal mencatat' });
      }
    } catch {
      setPesan({ tipe: 'error', teks: 'Gangguan jaringan' });
    }
    setLoadingKirim(false);
  }

  async function mulai(depan = kameraDepan) {
    if (!kelompokId) {
      setPesan({ tipe: 'error', teks: 'Pilih kelompok dulu' });
      return;
    }
    await hentikan();
    // Reset anti-double tiap ganti kelompok/tanggal/sesi scan baru
    setSudahScan(new Set());
    setPesan(null);
    setScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: depan ? 'user' : 'environment' },
        { fps: 5, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (teks) => kirimKode(teks),
        () => {}
      );
    } catch (e) {
      setScanning(false);
      setPesan({ tipe: 'error', teks: 'Kamera ditolak / tidak tersedia. Pakai input kode manual di bawah.' });
    }
  }

  async function balikKamera() {
    const next = !kameraDepan;
    setKameraDepan(next);
    if (scanning) await mulai(next);
  }

  async function hentikan() {
    try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch {}
    scannerRef.current = null;
    setScanning(false);
  }

  return (
    <AppScreen>
      {flash && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-green-600/25">
          <div className="mx-6 rounded-3xl bg-white px-8 py-6 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto size-12 text-green-600" />
            <p className="mt-2 text-xl font-extrabold text-ink">{flash.nama}</p>
            <p className="text-sm font-bold text-green-700">Hadir {flash.jam}</p>
          </div>
        </div>
      )}
      <div className="px-5 pt-6">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard" className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]" />
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink"><ScanLine className="size-5" /> Scan QR</h1>
        </div>

        <div className="card-soft mt-5 space-y-3 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Kelompok</label>
            <select value={kelompokId} onChange={e => setKelompokId(e.target.value)} className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40">
              <option value="">— Pilih kelompok —</option>
              {kelompokList.map(k => <option key={k.id} value={k.id}>{k.nama_kelompok}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tanggal</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          {!scanning ? (
            <button onClick={() => mulai()} className="w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]">Mulai Scan</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={balikKamera} className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-4 py-3.5 text-sm font-bold text-ink active:scale-[0.99]"><SwitchCamera className="size-4" /> {kameraDepan ? 'Belakang' : 'Depan'}</button>
              <button onClick={hentikan} className="w-full rounded-full bg-secondary py-3.5 text-sm font-bold text-ink active:scale-[0.99]">Hentikan</button>
            </div>
          )}
          {pesan && (
            <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${pesan.tipe === 'sukses' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {pesan.tipe === 'sukses' ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
              {pesan.teks}
            </div>
          )}
        </div>

        <div className="card-soft mt-4 overflow-hidden p-4">
          <div id="qr-reader" className="w-full overflow-hidden rounded-2xl" />
          {!scanning && <p className="py-6 text-center text-xs text-muted-foreground">Kamera mati. Tekan Mulai Scan untuk mengaktifkan.</p>}
        </div>

        <div className="card-soft mt-4 p-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Keyboard className="size-3.5" /> Input kode manual</label>
          <div className="flex gap-2">
            <input value={kodeManual} onChange={e => setKodeManual(e.target.value)} placeholder="cth: A8K2P4QZ" className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold uppercase outline-none focus:ring-2 focus:ring-primary/40" />
            <button onClick={() => { kirimKode(kodeManual); setKodeManual(''); }} disabled={loadingKirim || !kodeManual.trim()} className="shrink-0 rounded-full brand-gradient px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">Kirim</button>
          </div>
        </div>

        {riwayat.length > 0 && (
          <div className="card-soft mt-4 p-4">
            <h2 className="text-sm font-extrabold text-ink">Riwayat scan ({riwayat.length})</h2>
            <ul className="mt-3 space-y-2">
              {riwayat.map((r, i) => (
                <li key={i} className={`flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-semibold ${r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  <span className="truncate">{r.nama}</span>
                  <span className="shrink-0 text-xs">{r.ok ? r.jam : r.waktu}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="h-32" />
      </div>
    </AppScreen>
  );
}
