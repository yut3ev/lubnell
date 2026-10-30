import { NextRequest, NextResponse } from 'next/server';
import { addSubscription, pushStatus, removeSubscription } from '@/lib/push';

export const dynamic = 'force-dynamic';

// public: the VAPID public key is public by design; only the count leaks
export async function GET() {
  const status = await pushStatus();
  const vapid = await import('@/lib/push').then((m) => m.publicKeyForClient());
  return NextResponse.json({ ok: true, ...status, publicKey: vapid });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sub = body?.subscription || body;
    const endpoint = String(sub?.endpoint || '');
    if (!endpoint.startsWith('https://')) {
      return NextResponse.json({ ok: false, error: 'invalid subscription' }, { status: 400 });
    }
    const result = await addSubscription({ endpoint, keys: sub?.keys, at: new Date().toISOString() });
    return NextResponse.json({ ok: result.ok, count: result.count });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || '');
    if (!endpoint.startsWith('https://')) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
