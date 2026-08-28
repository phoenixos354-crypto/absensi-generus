import { Sprout, Leaf, TreeDeciduous, Flower2, BookOpen } from 'lucide-react';

export const TINGKATAN_LABEL = {
  caberawit:  { label: 'Caberawit',     Icon: Sprout },
  praremaja:  { label: 'Pra Remaja',    Icon: Leaf },
  remaja:     { label: 'Remaja',        Icon: TreeDeciduous },
  usianikah:  { label: 'Usia Nikah',    Icon: Flower2 },
  kelompok:   { label: 'Ngaji Kelompok',Icon: BookOpen },
};

export function TingkatanIcon({ tingkatan, className = 'size-4' }) {
  const t = TINGKATAN_LABEL[tingkatan] || TINGKATAN_LABEL.kelompok;
  const Icon = t.Icon;
  return <Icon className={className} />;
}

export function getTingkatan(tingkatan) {
  return TINGKATAN_LABEL[tingkatan] || TINGKATAN_LABEL.kelompok;
}
