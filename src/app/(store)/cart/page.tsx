import { db } from '@/lib/db';
import { CartView } from '@/components/store/cart-view';

export const dynamic = 'force-dynamic';

// U19-SETTINGS — /cart now renders the settings-driven CartView (it was
// pointing at an older checkout that baked the shipping fee / WhatsApp number
// / greeting as constants and ignored Studio → الشحن والدفع entirely).
// The orders WhatsApp number comes from her saved store settings.
export default async function CartPage() {
  let whatsapp: string | undefined;
  try {
    const rows = await db.storeSettings.findMany({ where: { key: 'store' } });
    const val = JSON.parse(rows[0]?.value ?? '{}') as { whatsappNumber?: unknown };
    if (typeof val.whatsappNumber === 'string' && val.whatsappNumber.trim()) {
      whatsapp = val.whatsappNumber.trim();
    }
  } catch {
    // DB unavailable → CartView falls back to the shipped constant
  }
  return <CartView whatsapp={whatsapp} />;
}
