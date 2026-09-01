import { NextResponse } from 'next/server';

const IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const MIDTRANS_API_BASE = IS_PROD
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com';
const MIDTRANS_SNAP_BASE = IS_PROD
  ? 'https://app.midtrans.com'
  : 'https://app.sandbox.midtrans.com';

function authHeader() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new Error('MIDTRANS_SERVER_KEY belum diset di .env.local');
  return 'Basic ' + Buffer.from(`${serverKey}:`).toString('base64');
}

// POST: bikin transaksi Snap sesuai nominal yang diisi user, cuma nawarin QRIS,
// balikin snap token buat dibuka via window.snap.pay() di frontend.
export async function POST(req) {
  try {
    const { amount, note } = await req.json();
    const gross_amount = Math.round(Number(amount));

    if (!gross_amount || gross_amount < 1000) {
      return NextResponse.json(
        { error: 'Nominal minimal Rp 1.000' },
        { status: 400 }
      );
    }

    const order_id = `traktir-${Date.now()}`;

    const res = await fetch(`${MIDTRANS_SNAP_BASE}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        transaction_details: { order_id, gross_amount },
        // Cuma tawarin QRIS - biar Snap langsung nunjukin QR-nya,
        // skip halaman pilih metode pembayaran.
        enabled_payments: ['other_qris'],
        expiry: { unit: 'minutes', duration: 15 },
        item_details: [
          {
            id: 'traktir-kopi',
            price: gross_amount,
            quantity: 1,
            name: note ? `Traktir Kopi - ${note}`.slice(0, 50) : 'Traktir Kopi',
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.token) {
      console.error('[traktir-kopi] Midtrans Snap error:', data);
      return NextResponse.json(
        { error: (data.error_messages || []).join(', ') || 'Gagal bikin transaksi', detail: data },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json({
      order_id,
      token: data.token,
      gross_amount,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}

// GET: cek status pembayaran (dipakai sebagai cadangan/verifikasi tambahan,
// snap.pay() sendiri sudah punya callback onSuccess/onPending/onError)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const order_id = searchParams.get('order_id');
    if (!order_id) return NextResponse.json({ error: 'order_id wajib diisi' }, { status: 400 });

    const res = await fetch(`${MIDTRANS_API_BASE}/v2/${order_id}/status`, {
      headers: { Accept: 'application/json', Authorization: authHeader() },
    });
    const data = await res.json();

    if (!res.ok) {
      // Transaksi Snap yang baru dibuat & belum disentuh user kadang belum
      // punya status (404) - anggap masih pending, bukan error keras.
      return NextResponse.json({ transaction_status: 'pending' });
    }

    return NextResponse.json({
      transaction_status: data.transaction_status, // pending | settlement | expire | cancel | deny
      gross_amount: data.gross_amount,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
