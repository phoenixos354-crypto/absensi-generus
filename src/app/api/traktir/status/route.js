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

export async function GET(req) {
  const auth = authHeader();
  if (!auth) {
    return NextResponse.json({ error: 'MIDTRANS_SERVER_KEY belum diset' }, { status: 500 });
  }

  const orderId = req.nextUrl.searchParams.get('order_id');
  if (!orderId) {
    return NextResponse.json({ error: 'order_id wajib diisi' }, { status: 400 });
  }

  try {
    const res = await fetch(`${midtransBaseUrl()}/v2/${encodeURIComponent(orderId)}/status`, {
      headers: { Accept: 'application/json', Authorization: auth },
      cache: 'no-store',
    });
    const data = await res.json();

    if (!res.ok && res.status !== 404) {
      return NextResponse.json(
        { error: data?.status_message || 'Gagal cek status transaksi' },
        { status: res.status }
      );
    }

    return NextResponse.json({ transaction_status: data.transaction_status || 'pending' });
  } catch (e) {
    return NextResponse.json({ error: 'Tidak bisa menghubungi Midtrans' }, { status: 502 });
  }
}
