import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await db.product.count();
    return NextResponse.json({
      ok: true,
      site: 'LUBNÉL',
      products,
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: true, site: 'LUBNÉL', degraded: true });
  }
}
