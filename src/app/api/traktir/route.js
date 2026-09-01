import { NextResponse } from 'next/server';

function midtransBaseUrl() {
  const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  return isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

function authHeader() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return null;
  return 'Basic ' + Buffer.from(`${serverKey}:`).toString('base64');
}

export async function POST(req) {
  const auth = authHeader();
  if (!auth) {
    return NextResponse.json(
      { error: 'MIDTRANS_SERVER_KEY belum diset di environment variable.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const amount = Math.round(Number(body?.amount));
  const note = typeof body?.note === 'string' ? body.note.slice(0, 255) : '';

  if (!Number.isFinite(amount) || amount < 1000) {
    return NextResponse.json({ error: 'Nominal minimal Rp1.000' }, { status: 400 });
  }

  const orderId = `traktir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const res = await fetch(`${midtransBaseUrl()}/v2/charge`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({
        payment_type: 'qris',
        transaction_details: { order_id: orderId, gross_amount: amount },
        qris: { acquirer: 'gopay' },
        custom_field1: note || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.status_message || 'Gagal membuat transaksi QRIS' },
        { status: res.status }
      );
    }

    const qrAction = (data.actions || []).find((a) => a.name === 'generate-qr-code');

    return NextResponse.json({
      order_id: data.order_id,
      qr_url: qrAction?.url || null,
      qr_string: data.qr_string || null,
      expiry_time: data.expiry_time || null,
      transaction_status: data.transaction_status,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Tidak bisa menghubungi Midtrans' }, { status: 502 });
  }
}
