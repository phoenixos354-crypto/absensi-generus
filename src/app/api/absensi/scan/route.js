import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readWhere, readLatestByKeyWhere, appendRows, SHEETS, generateId } from '@/lib/sheets';
import { getPermission } from '@/lib/permission';
import { NextResponse } from 'next/server';

// POST /api/absensi/scan { kode_publik, kelompok_id, tanggal }
// Cari murid via kode_publik, catat Hadir + jam sekarang (append-only).
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { kode_publik, kelompok_id, tanggal, jam_datang } = await req.json();
  if (!kode_publik || !kelompok_id || !tanggal) {
    return NextResponse.json({ error: 'kode_publik, kelompok_id, dan tanggal wajib' }, { status: 400 });
  }

  const perm = await getPermission(session.user.email, kelompok_id);
  if (!perm) return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  if (perm === 'viewer') return NextResponse.json({ error: 'Anda hanya bisa melihat laporan' }, { status: 403 });

  // Normalisasi: ambil token terakhir kalau QR berisi URL, huruf besar, buang spasi/simbol
  const mentah = String(kode_publik).trim();
  const token = mentah.split(/[\s/?#=&]+/).filter(Boolean).pop() || mentah;
  const kode = token.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const kandidat = [...new Set([mentah, token, kode])];
  let murid = null;
  for (const k of kandidat) {
    murid = (await readWhere(SHEETS.MURID, { kode_publik: k }))[0];
    if (murid) break;
  }
  if (!murid) {
    const atas = kode.toUpperCase();
    const semua = await readWhere(SHEETS.MURID, {});
    murid = semua.find(m => String(m.kode_publik || '').toUpperCase() === atas)
      || semua.find(m => m.id === mentah || m.id === token);
  }
  if (!murid) murid = (await readWhere(SHEETS.MURID, { id: mentah }))[0];
  if (!murid) return NextResponse.json({ error: `Kode QR tidak dikenal: ${String(mentah).slice(0, 24)}` }, { status: 404 });
  if (murid.kelompok_id !== kelompok_id) {
    return NextResponse.json({ error: 'Kartu ini milik kelompok lain' }, { status: 400 });
  }

  // Anti-double: kalau murid ini sudah Hadir hari ini, jangan tulis lagi
  const sudah = await readLatestByKeyWhere(
    SHEETS.ABSENSI,
    { kelompok_id },
    a => `${a.kelompok_id}|${a.murid_id}|${a.tanggal}`
  );
  const barisIni = sudah.find(a => a.murid_id === murid.id && a.tanggal === tanggal);
  if (barisIni?.status === 'Hadir') {
    return NextResponse.json({ success: true, sudah: true, nama: murid.nama_murid, murid_id: murid.id, jam_datang: barisIni.jam_datang || '' });
  }

  const now = new Date();
  // Utamakan jam dari HP pencatat (zona lokal), fallback jam server
  const jam = /^\d{2}:\d{2}$/.test(jam_datang || '') ? jam_datang : `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const rows = [[
    generateId(), kelompok_id, murid.id, tanggal, 'Hadir', session.user.email, now.toISOString(), jam,
  ]];

  // Sisa murid yang belum ada barisnya hari ini → Alfa (biar persen jujur)
  const semuaMurid = await readWhere(SHEETS.MURID, { kelompok_id });
  const adaId = new Set(sudah.filter(a => a.tanggal === tanggal).map(a => a.murid_id));
  adaId.add(murid.id);
  for (const m of semuaMurid) {
    if (!adaId.has(m.id)) {
      rows.push([generateId(), kelompok_id, m.id, tanggal, 'Alfa', session.user.email, now.toISOString(), '']);
    }
  }
  await appendRows(SHEETS.ABSENSI, rows);

  return NextResponse.json({ success: true, nama: murid.nama_murid, murid_id: murid.id, jam_datang: jam });
}
