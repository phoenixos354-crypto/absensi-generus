import { NextResponse } from 'next/server';

const IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const MIDTRANS_BASE = IS_PROD
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com';

function authHeader() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new Error('MIDTRANS_SERVER_KEY belum diset di .env.local');
  return 'Basic ' + Buffer.from(`${serverKey}:`).toString('base64');
}

// POST: bikin transaksi QRIS baru sesuai nominal yang diisi user, balikin QR-nya
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

    const res = await fetch(`${MIDTRANS_BASE}/v2/charge`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        payment_type: 'qris',
        transaction_details: { order_id, gross_amount },
        qris: { acquirer: 'gopay' },
        custom_expiry: {
          expiry_duration: 15,
          unit: 'minute',
        },
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

    if (!res.ok) {
      console.error('[traktir-kopi] Midtrans charge error:', data);
      return NextResponse.json(
        { error: data.status_message || 'Gagal bikin QRIS', detail: data },
        { status: res.status }
      );
    }

    const qrAction = (data.actions || []).find((a) => a.name === 'generate-qr-code');
    if (!qrAction) {
      console.error('[traktir-kopi] Respon Midtrans tanpa generate-qr-code:', data);
      return NextResponse.json(
        {
          error:
            data.status_message ||
            `QR tidak tersedia dari Midtrans (status_code: ${data.status_code || '?'})`,
          detail: data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      order_id: data.order_id,
      qr_url: qrAction.url,
      expiry_time: data.expiry_time,
      gross_amount,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}

// GET: cek status pembayaran buat polling dari frontend
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const order_id = searchParams.get('order_id');
    if (!order_id) return NextResponse.json({ error: 'order_id wajib diisi' }, { status: 400 });

    const res = await fetch(`${MIDTRANS_BASE}/v2/${order_id}/status`, {
      headers: { Accept: 'application/json', Authorization: authHeader() },
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.status_message || 'Gagal cek status' },
        { status: res.status }
      );
    }

    return NextResponse.json({
      transaction_status: data.transaction_status, // pending | settlement | expire | cancel | deny
      gross_amount: data.gross_amount,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
