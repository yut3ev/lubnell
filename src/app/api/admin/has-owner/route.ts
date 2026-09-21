import { NextResponse } from 'next/server';
import { hasOwner } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, hasOwner: await hasOwner() });
  } catch (err) {
    console.error('[admin/has-owner]', err);
    return NextResponse.json({ ok: false, hasOwner: false }, { status: 500 });
  }
}
