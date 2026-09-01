'use client';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { IdCard, MapPin, Map, Users, Home, Heart, HeartCrack, Venus, Mars, UserRound } from 'lucide-react';

const fetcher = (url) => fetch(url).then(r => r.json());

const STAT_CARDS = [
  { key: 'jumlah_kk', label: 'Kepala Keluarga', Icon: Home },
  { key: 'total', label: 'Total Jamaah', Icon: Users },
  { key: 'laki_laki', label: 'Laki-laki', Icon: Mars },
  { key: 'perempuan', label: 'Perempuan', Icon: Venus },
  { key: 'lansia', label: 'Lansia', Icon: UserRound },
  { key: 'janda', label: 'Janda', Icon: HeartCrack },
  { key: 'duda', label: 'Duda', Icon: HeartCrack },
  { key: 'muda_mudi', label: 'Muda-Mudi', Icon: Users },
  { key: 'usia_nikah', label: 'Usia Nikah', Icon: Heart },
  { key: 'caberawit', label: 'Caberawit', Icon: UserRound },
];

export default function KartuJamaahPublikPage() {
  const params = useParams();
  const kode = params.kode;
  const { data, error, isLoading } = useSWR(kode ? `/api/publik-jamaah/${kode}` : null, fetcher);

  if (isLoading) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <p className="text-lg font-extrabold text-ink">Kartu tidak ditemukan</p>
        <p className="text-sm text-muted-foreground">Cek kembali link yang dibagikan ya.</p>
      </div>
    );
  }

  const stats = data.stats || {};

  return (
    <div className="app-shell min-h-dvh bg-background pb-10">
      <section className="px-5 pt-8">
        <div className="rounded-3xl brand-gradient p-5 shadow-[var(--shadow-float)]">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground/75">
            <IdCard className="size-3.5" /> Kartu Data Jamaah
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-primary-foreground">{data.nama_kelompok}</h1>
          {(data.desa || data.daerah) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.desa && (
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <MapPin className="size-3" /> {data.desa}
                </span>
              )}
              {data.daerah && (
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <Map className="size-3.5" /> {data.daerah}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="px-5 pt-4">
        <div className="card-soft p-4">
          <h2 className="text-sm font-extrabold text-ink">Rekap Data Jamaah</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {STAT_CARDS.map(({ key, label, Icon }) => (
              <div key={key} className="flex items-center gap-2.5 rounded-2xl bg-secondary p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-extrabold leading-none text-ink">{stats[key] ?? 0}</p>
                  <p className="truncate text-[10px] font-semibold text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="mt-6 px-5 text-center text-[11px] text-muted-foreground">
        Data ini hanya berupa rekap ringkas, tanpa daftar nama, demi menjaga privasi jamaah.
      </p>
    </div>
  );
}
