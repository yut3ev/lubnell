import { db } from '@/lib/db';

export type CouponResult = {
  valid: boolean;
  code: string;
  discount: number;
  message: string;
  label?: string | null;
};

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export async function validateCoupon(code: string, subtotal: number): Promise<CouponResult> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { valid: false, code: '', discount: 0, message: 'أدخلي كود الخصم أولًا' };
  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.active)
    return { valid: false, code: normalized, discount: 0, message: 'كود الخصم غير صالح' };
  const now = Date.now();
  if (coupon.startsAt && coupon.startsAt.getTime() > now)
    return { valid: false, code: normalized, discount: 0, message: 'هذا الكود لم يبدأ بعد' };
  if (coupon.endsAt && coupon.endsAt.getTime() < now)
    return { valid: false, code: normalized, discount: 0, message: 'انتهت صلاحية كود الخصم' };
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit)
    return { valid: false, code: normalized, discount: 0, message: 'اكتمل عدد استخدامات هذا الكود' };
  if (subtotal < coupon.minSubtotal)
    return {
      valid: false,
      code: normalized,
      discount: 0,
      message: `الحد الأدنى لهذا الكود ${coupon.minSubtotal} ج.م`,
    };
  let discount =
    coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.max(0, Math.min(discount, subtotal));
  return {
    valid: true,
    code: normalized,
    discount,
    message: coupon.label || `تم تطبيق خصم ${coupon.type === 'percent' ? `${coupon.value}%` : `${coupon.value} ج.م`}`,
    label: coupon.label,
  };
}

export async function incrementCouponUsage(code: string) {
  if (!code) return;
  const coupon = await db.coupon.findUnique({
    where: { code: normalizeCouponCode(code) },
    select: { id: true, usageCount: true, usageLimit: true },
  });
  if (!coupon) return;
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) return;
  await db.coupon
    .update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } })
    .catch(() => undefined);
}
