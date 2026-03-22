import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { initializeSheets } from '@/lib/sheets';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await initializeSheets();
    return NextResponse.json({ success: true, message: 'Sheets berhasil diinisialisasi' });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
