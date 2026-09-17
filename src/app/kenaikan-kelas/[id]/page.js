'use client';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppScreen } from '@/components/AppScreen';
import { BackButton } from '@/components/BackButton';
import { TingkatanIcon, getTingkatan } from '@/components/tingkatan';
import { KELAS_CABERAWIT_LABEL } from '@/lib/target-constants';
import { GraduationCap, ArrowRight, Check, X, TriangleAlert, PartyPopper, Users } from 'lucide-react';

export default function KenaikanKelasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const kelompokId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kelompok, setKelompok] = useState(null);      // { id, nama_kelompok, tingkatan, kelompok_tujuan_id }
  const [daftarTujuan, setDaftarTujuan] = useState([]); // kelompok satu tingkat di atas (milik owner)
  const [murid, setMurid] = useState([]);               // [{ murid_id, nama_murid, sub_kelas, persen, tercapai, total, layak_saran, jenis_saran, saran_sub_kelas... }]
  const [threshold, setThreshold] = useState(80);

  const [langkah, setLangkah] = useState(1);            // 1: pilih tujuan, 2: pilih murid, 3: ringkasan
  const [jenis, setJenis] = useState('sub_kelas');      // 'sub_kelas' | 'tingkat'
  const [tujuanId, setTujuanId] = useState('');         // kelompok_tujuan_id terpilih (langkah 1)
  const [keSubKelas, setKeSubKelas] = useState('');     // sub-kelas tujuan kalau jenis sub_kelas
  const [dipilih, setDipilih] = useState({});           // { murid_id: true/false } — guru bisa override manual
  const [menyimpan, setMenyimpan] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);  // dialog konfirmasi langkah 3
  const [hasil, setHasil] = useState(null);             // hasil sukses setelah POST

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  useEffect(() => {
    if (session && kelompokId) muatData();
  }, [session, kelompokId]);

  async function muatData() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/kenaikan-kelas?kelompok_id=${kelompokId}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal memuat data.'); setLoading(false); return; }

      setKelompok(data.kelompok);
      setMurid(data.murid || []);
      setThreshold(data.threshold || 80);
      setTujuanId(data.kelompok?.kelompok_tujuan_id || '');

      // Langkah 1: kalau kelompok belum punya kelompok_tujuan_id, minta guru
      // pilih dulu. Dropdown diisi kelompok satu tingkat lebih tinggi.
      if (data.kelompok?.kelompok_tujuan_id) {
        setLangkah(2);
        // Default jenis: caberawit -> naik sub-kelas; lainnya -> naik tingkat
        setJenis(data.kelompok.tingkatan === 'caberawit' ? 'sub_kelas' : 'tingkat');
      } else {
        setLangkah(1);
        // Ambil daftar kelompok milik user untuk dropdown pilihan tujuan
        const resK = await fetch('/api/kelompok');
        if (resK.ok) {
          const semua = await resK.json();
          const URUTAN = ['caberawit', 'praremaja', 'remaja', 'usianikah'];
          const idx = URUTAN.indexOf(data.kelompok?.tingkatan);
          const tingkatBerikut = idx >= 0 && idx < URUTAN.length - 1 ? URUTAN[idx + 1] : null;
          setDaftarTujuan((semua || []).filter(k =>
            tingkatBerikut && k.tingkatan === tingkatBerikut && k.id !== kelompokId
          ));
        }
      }

      // Pre-check checkbox otomatis untuk yang >= threshold (guru tetap bisa ubah)
      const awal = {};
      for (const m of (data.murid || [])) awal[m.murid_id] = !!m.layak_saran;
      setDipilih(awal);
    } catch {
      setError('Gagal memuat data. Coba lagi.');
    }
    setLoading(false);
  }

  const terpilihList = murid.filter(m => dipilih[m.murid_id]);
  const adaSubKelasInfo = murid.some(m => m.sub_kelas);

  function toggleMurid(id) {
    setDipilih(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function pilihSemua() {
    const semua = {};
    for (const m of murid) semua[m.murid_id] = true;
    setDipilih(semua);
  }
  function kosongkanSemua() {
    const semua = {};
    for (const m of murid) semua[m.murid_id] = false;
    setDipilih(semua);
  }

  // Simpan pilihan kelompok tujuan (langkah 1) lalu lanjut ke langkah 2
  async function simpanTujuan() {
    if (!tujuanId) return;
    setMenyimpan(true);
    const res = await fetch('/api/kenaikan-kelas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kelompok_id: kelompokId, kelompok_tujuan_id: tujuanId }),
    });
    setMenyimpan(false);
    if (res.ok) {
      setKelompok(prev => ({ ...prev, kelompok_tujuan_id: tujuanId }));
      setLangkah(2);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Gagal menyimpan kelompok tujuan.');
    }
  }

  async function jalankanKenaikan() {
    setMenyimpan(true);
    setError('');
    const body = {
      kelompok_id: kelompokId,
      jenis,
      murid_ids: terpilihList.map(m => m.murid_id),
    };
    if (jenis === 'sub_kelas') body.ke_sub_kelas = keSubKelas;
    if (jenis === 'tingkat') body.ke_kelompok_id = kelompok.kelompok_tujuan_id;

    const res = await fetch('/api/kenaikan-kelas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setMenyimpan(false);
    setKonfirmasi(false);
    if (!res.ok) { setError(data.error || 'Gagal menjalankan kenaikan.'); return; }
    setHasil(data);
  }

  if (loading || status === 'loading') {
    return (
      <AppScreen>
        <div className="space-y-4 px-5 pt-8">
          <div className="h-10 w-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-44 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
          <div className="h-64 animate-pulse rounded-3xl bg-surface shadow-[var(--shadow-card)]" />
        </div>
      </AppScreen>
    );
  }

  if (error && !kelompok) {
    return (
      <AppScreen>
        <div className="px-5 pt-16 text-center">
          <TriangleAlert className="mx-auto size-10 text-destructive" />
          <p className="mt-3 text-sm font-bold text-ink">{error}</p>
          <button onClick={() => router.back()} className="mt-4 rounded-full bg-secondary px-6 py-3 text-sm font-bold text-ink">
            Kembali
          </button>
        </div>
      </AppScreen>
    );
  }

  const tk = getTingkatan(kelompok?.tingkatan);

  // ================= HASIL SUKSES =================
  if (hasil) {
    return (
      <AppScreen>
        <div className="px-5 pt-12 text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <PartyPopper className="size-10" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-ink">Alhamdulillah, Selesai!</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {hasil.jumlah} murid telah dinaikkan{' '}
            {hasil.jenis === 'sub_kelas'
              ? <>ke <span className="font-bold text-ink">{hasil.ke_sub_kelas_label || 'kelas berikutnya'}</span></>
              : <>ke kelompok <span className="font-bold text-ink">{hasil.ke_kelompok?.nama_kelompok}</span></>}
            .
          </p>

          <div className="card-soft mt-6 space-y-2 p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Murid yang naik</p>
            {(hasil.murid || []).map(m => (
              <div key={m.murid_id} className="flex items-center gap-2.5 rounded-2xl bg-secondary/60 p-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.nama_murid}</span>
                <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                  {hasil.jenis === 'sub_kelas'
                    ? `${KELAS_CABERAWIT_LABEL[m.dari_sub_kelas] || m.dari_sub_kelas || '—'} → ${hasil.ke_sub_kelas_label}`
                    : 'pindah kelompok'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            <button
              onClick={() => router.push(jenis === 'tingkat' && hasil.ke_kelompok ? `/kelompok/${hasil.ke_kelompok.id}` : `/kelompok/${kelompokId}`)}
              className="w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99]"
            >
              Selesai
            </button>
            <button
              onClick={() => { setHasil(null); muatData(); }}
              className="w-full rounded-full bg-secondary py-3 text-sm font-bold text-ink"
            >
              Naikkan lagi
            </button>
          </div>
        </div>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {/* Header */}
      <header className="px-5 pt-6">
        <BackButton
          fallbackHref={`/kelompok/${kelompokId}`}
          className="grid size-10 place-items-center rounded-full bg-surface shadow-[var(--shadow-card)]"
        />
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-extrabold text-ink">
          <GraduationCap className="size-6 text-primary" /> Naik Kelas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {kelompok.nama_kelompok} · {tk.label}
        </p>

        {/* Indikator langkah */}
        <div className="mt-4 flex items-center gap-2">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex flex-1 items-center gap-2">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                langkah > n ? 'bg-emerald-500 text-white' : langkah === n ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>
                {langkah > n ? <Check className="size-3.5" /> : n}
              </span>
              {n < 3 && <span className={`h-0.5 flex-1 rounded ${langkah > n ? 'bg-emerald-500' : 'bg-border'}`} />}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          {langkah === 1 ? 'Pilih kelompok tujuan' : langkah === 2 ? 'Pilih murid yang naik' : 'Periksa & konfirmasi'}
        </p>
      </header>

      {error && (
        <div className="mx-5 mt-4 rounded-2xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">{error}</div>
      )}

      {/* ================= LANGKAH 1: pilih kelompok tujuan ================= */}
      {langkah === 1 && (
        <section className="px-5 pt-4">
          <div className="card-soft p-4">
            <h2 className="text-base font-bold text-ink">Ke kelompok mana murid akan naik?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pilih kelompok tingkat di atas {tk.label} (milik Anda). Pilihan ini disimpan supaya tidak perlu dipilih lagi tahun depan.
            </p>
            {daftarTujuan.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-amber-50 p-3.5 text-xs font-medium text-amber-700">
                Belum ada kelompok tingkat {(() => {
                  const URUTAN = ['caberawit', 'praremaja', 'remaja', 'usianikah'];
                  const idx = URUTAN.indexOf(kelompok.tingkatan);
                  return idx >= 0 && idx < URUTAN.length - 1 ? getTingkatan(URUTAN[idx + 1]).label : 'di atas';
                })()} yang Anda buat. Buat dulu kelompoknya di Dashboard, lalu kembali ke sini.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {daftarTujuan.map(k => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setTujuanId(k.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors ${
                      tujuanId === k.id ? 'bg-brand-soft ring-2 ring-primary' : 'bg-secondary'
                    }`}
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tujuanId === k.id ? 'bg-primary text-primary-foreground' : 'bg-border text-muted-foreground'}`}>
                      <TingkatanIcon tingkatan={k.tingkatan} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{k.nama_kelompok}</span>
                      <span className="block text-xs text-muted-foreground">{getTingkatan(k.tingkatan).label} · {k.desa}</span>
                    </span>
                    {tujuanId === k.id && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={simpanTujuan}
              disabled={!tujuanId || menyimpan}
              className="mt-4 w-full rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] disabled:opacity-60"
            >
              {menyimpan ? 'Menyimpan...' : 'Lanjut'}
            </button>
          </div>
        </section>
      )}

      {/* ================= LANGKAH 2: pilih murid ================= */}
      {langkah === 2 && (
        <section className="px-5 pt-4">
          <div className="card-soft p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink">Murid yang naik kelas</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Yang dicentang otomatis sudah mencapai ≥{threshold}% target. Silakan ubah sesuai penilaian Anda.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-primary">
                {terpilihList.length}/{murid.length}
              </span>
            </div>

            {/* Jenis kenaikan */}
            <div className="mt-4 rounded-2xl bg-secondary p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Jenis kenaikan</p>
              {kelompok.tingkatan === 'caberawit' ? (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setJenis('sub_kelas')}
                      className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${jenis === 'sub_kelas' ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground'}`}
                    >
                      Naik Kelas (dalam kelompok ini)
                    </button>
                    <button
                      type="button"
                      onClick={() => setJenis('tingkat')}
                      className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${jenis === 'tingkat' ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground'}`}
                    >
                      Pindah Kelompok
                    </button>
                  </div>
                  {jenis === 'sub_kelas' ? (
                    <div className="mt-3">
                      <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Kelas tujuan</label>
                      <select
                        value={keSubKelas}
                        onChange={e => setKeSubKelas(e.target.value)}
                        className="w-full appearance-none rounded-xl bg-surface px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="">— Pilih kelas tujuan —</option>
                        {Object.entries(KELAS_CABERAWIT_LABEL).filter(([key]) => key !== '').map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      {!adaSubKelasInfo && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Tips: isi dulu “Kelas/Jenjang” tiap murid di halaman Kelola, supaya naik kelasnya rapi.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Murid terpilih akan pindah ke kelompok tujuan yang dipilih di langkah 1.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Murid terpilih akan pindah ke kelompok <span className="font-bold text-ink">
                    {(() => {
                      const tujuan = daftarTujuan.find(k => k.id === kelompok.kelompok_tujuan_id);
                      return tujuan ? tujuan.nama_kelompok : 'tujuan';
                    })()}
                  </span>.
                </p>
              )}
            </div>

            {/* Kartu per murid */}
            <div className="no-scrollbar mt-4 max-h-[26rem] space-y-2 overflow-y-auto">
              {murid.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Belum ada murid di kelompok ini.</p>
              ) : murid.map(m => (
                <button
                  key={m.murid_id}
                  type="button"
                  onClick={() => toggleMurid(m.murid_id)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors ${
                    dipilih[m.murid_id] ? 'bg-brand-soft ring-1 ring-primary/40' : 'bg-secondary/60'
                  }`}
                >
                  <span className={`grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors ${
                    dipilih[m.murid_id] ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface'
                  }`}>
                    {dipilih[m.murid_id] && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-ink">{m.nama_murid}</span>
                      {m.sub_kelas_label ? (
                        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-primary">
                          {m.sub_kelas_label}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Target: {m.tercapai}/{m.total} {m.persen >= threshold ? '✅' : '⏳'} · {m.persen}%
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold ${
                    m.persen >= threshold ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {m.persen}%
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button onClick={pilihSemua} className="flex-1 rounded-full bg-secondary py-2 text-xs font-bold text-ink">Pilih semua</button>
              <button onClick={kosongkanSemua} className="flex-1 rounded-full bg-secondary py-2 text-xs font-bold text-ink">Kosongkan</button>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setLangkah(1)} className="rounded-full bg-secondary px-5 py-3.5 text-sm font-bold text-ink">Kembali</button>
              <button
                onClick={() => setLangkah(3)}
                disabled={terpilihList.length === 0 || (jenis === 'sub_kelas' && !keSubKelas)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] disabled:opacity-60"
              >
                Lanjut <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================= LANGKAH 3: ringkasan & konfirmasi ================= */}
      {langkah === 3 && (
        <section className="px-5 pt-4">
          <div className="card-soft p-4">
            <h2 className="text-base font-bold text-ink">Ringkasan</h2>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                  <Users className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-ink">{terpilihList.length} murid akan naik</p>
                  <p className="text-xs text-muted-foreground">
                    {jenis === 'sub_kelas'
                      ? `Naik ke kelas ${KELAS_CABERAWIT_LABEL[keSubKelas] || keSubKelas} — tetap di kelompok ${kelompok.nama_kelompok}`
                      : `Pindah kelompok ke tujuan yang sudah dipilih`}
                  </p>
                </div>
              </div>
              {jenis === 'tingkat' && (
                <p className="rounded-2xl bg-amber-50 p-3 text-xs font-medium text-amber-700">
                  Histori absensi & kas murid tetap tersimpan aman — tidak ada data yang dihapus.
                </p>
              )}
            </div>

            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {terpilihList.map(m => (
                <div key={m.murid_id} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                  <Check className="size-3.5 shrink-0 text-emerald-500" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.nama_murid}</span>
                  {m.sub_kelas_label && <span className="shrink-0 text-[10px] font-bold text-muted-foreground">{m.sub_kelas_label}</span>}
                </div>
              ))}
            </div>

            <button
              onClick={() => setKonfirmasi(true)}
              disabled={menyimpan}
              className="mt-4 w-full rounded-full brand-gradient py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-float)] active:scale-[0.99] disabled:opacity-60"
            >
              Ya, Naikkan Sekarang
            </button>
            <button onClick={() => setLangkah(2)} className="mt-2 w-full rounded-full bg-secondary py-3 text-sm font-bold text-ink">
              Kembali
            </button>
          </div>
        </section>
      )}

      {/* Dialog konfirmasi akhir */}
      {konfirmasi && (
        <div className="fixed inset-0 z-50 bg-ink/40" onClick={() => !menyimpan && setKonfirmasi(false)}>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[26rem] rounded-t-[2rem] bg-surface p-5 pb-8 text-center shadow-[var(--shadow-float)]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-primary">
              <GraduationCap className="size-7" />
            </div>
            <h3 className="mt-3 text-lg font-extrabold text-ink">Yakin naikkan sekarang?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {terpilihList.length} murid akan dinaikkan. Aksi ini tercatat dan bisa dicek, tapi sebaiknya dipastikan sekali lagi.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setKonfirmasi(false)} disabled={menyimpan} className="flex-1 rounded-full bg-secondary py-3.5 text-sm font-bold text-ink">
                Batal
              </button>
              <button onClick={jalankanKenaikan} disabled={menyimpan} className="flex-1 rounded-full brand-gradient py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
                {menyimpan ? 'Memproses...' : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-8" />
    </AppScreen>
  );
}
