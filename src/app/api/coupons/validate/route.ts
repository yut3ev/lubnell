import { NextRequest, NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/coupons';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, subtotal } = body as { code?: string; subtotal?: number };
    const result = await validateCoupon(String(code || ''), Math.max(0, Number(subtotal) || 0));
    return NextResponse.json({ ok: true, coupon: result });
  } catch {
    return NextResponse.json(
      { ok: false, coupon: { valid: false, code: '', discount: 0, message: 'تعذر التحقق من الكود الآن' } },
      { status: 500 }
    );
  }
}
