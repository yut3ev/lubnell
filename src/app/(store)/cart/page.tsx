import { db } from '@/lib/db';
import { CartView } from '@/components/store/cart-view';
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, WHATSAPP_NUMBER } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  let whatsapp = WHATSAPP_NUMBER;
  let shipping = SHIPPING_FEE;
  let freeFrom = FREE_SHIPPING_THRESHOLD;
  let currency = 'ج.م';
  let whatsappMessage = 'مرحبًا LUBNÉL 🌸';

  try {
    const rows = await db.storeSettings.findMany({ where: { key: 'store' } });
    const val = JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
    if (typeof val.whatsappNumber === 'string' && val.whatsappNumber.trim()) {
      whatsapp = val.whatsappNumber.trim();
    }
    const fee = Number(val.shippingFee);
    if (Number.isFinite(fee) && fee >= 0) shipping = fee;
    const threshold = Number(val.freeShippingThreshold);
    if (Number.isFinite(threshold) && threshold >= 0) freeFrom = threshold;
    if (typeof val.currency === 'string' && val.currency.trim()) currency = val.currency.trim();
    if (typeof val.whatsappMessage === 'string' && val.whatsappMessage.trim()) {
      whatsappMessage = val.whatsappMessage.trim();
    }
  } catch {
    // DB unavailable → fall back to defaults
  }

  const cleanWhatsapp = whatsapp.replace(/[^0-9]/g, '');

  return (
    <CartView
      initialSettings={{
        whatsapp: cleanWhatsapp,
        shipping,
        freeFrom,
        currency,
        whatsappMessage,
      }}
    />
  );
}
