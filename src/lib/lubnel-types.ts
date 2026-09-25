// Shared LUBNÉL types (client + server safe)

// U85-V1 (legacy) — [{label, value, ...}] rows
export type Variant = { label: string; value: string; price?: number; image?: string; color?: string; kind?: string };

// U85-V2 — ONE option group per product (الريحة / اللون…) with multiple
// options; the customer picks exactly ONE value for the cart line.
export type VariantOption = { value: string; image?: string; color?: string; description?: string };
export type ProductVariants = { group: string; options: VariantOption[] };

/** Parses the stored variants JSON — supports BOTH the legacy row array and
 * the V2 group object. Returns null when there are no usable options. */
export function parseVariants(json: string | null | undefined): ProductVariants | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as { group?: unknown; options?: unknown };
      if (Array.isArray(obj.options) && obj.options.length) {
        const group = String(obj.group ?? 'النوع').trim() || 'النوع';
        const options = (obj.options as VariantOption[]).filter((o) => o && String(o.value || '').trim());
        return options.length ? { group, options } : null;
      }
      return null;
    }
    if (Array.isArray(parsed) && parsed.length) {
      // legacy rows: identical labels = the group name; differing labels = the
      // option NAMES themselves → neutral group «النوع»
      const labels = (parsed as Variant[]).map((v) => String(v.label ?? '').trim()).filter(Boolean);
      const unique = [...new Set(labels)];
      const group = unique.length === 1 ? unique[0] : 'النوع';
      const options = (parsed as Variant[]).map((v) => ({
        value: String(v.label ?? v.value ?? '').trim(),
        image: v.image,
        color: v.color,
        description: v.value && (!v.label || v.value !== v.label) ? String(v.value) : undefined,
      })).filter((o) => o.value);
      return options.length ? { group, options } : null;
    }
  } catch { /* malformed → no variants */ }
  return null;
}

export function serializeVariants(v: ProductVariants): string {
  return JSON.stringify({ group: v.group.trim() || 'النوع', options: v.options.filter((o) => String(o.value || '').trim()) });
}

export type Product = {
  id: string;
  slug?: string;
  name: string;
  nameAr: string;
  category: string;
  categoryAr: string;
  price: number;
  oldPrice?: number;
  image: string;
  images?: string[];
  alt: string;
  badge?: string;
  badgeAr?: string;
  description: string;
  stock: number;
  featured?: boolean;
  shareCount?: number;
  visible?: boolean;
  variants?: Variant[];
};

export type HeroSlide = {
  id: string;
  eyebrow: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  ctaAr: string;
  ctaEn: string;
  image: string;
  active: boolean;
  sortOrder: number;
};

export type CartItem = Product & { quantity: number };

// Real rating summary per product (from approved reviews, served by /api/store/bootstrap)
export type RatingSummary = { average: number; count: number };

// Featured (pinned) review shown on the home page testimonials section
export type FeaturedReview = {
  id: string;
  productId: string;
  name: string;
  text: string;
  rating: number;
  image?: string | null;
  createdAt?: string;
  productTitle: string;
  productImage: string | null;
};

export type AdminProfile = {
  id: number;
  username: string;
  displayName: string;
  role: string;
  customRole: string | null;
  permissions: string[];
};

export type OrderRecord = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  giftNote?: string | null; // R31 — optional gift-card message
  items: { id: string; name: string; quantity: number; price: number }[];
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode: string | null;
  total: number;
  status: string;
  cancelRequested?: boolean;
  railConverted?: boolean; // R50 — order followed a converted cross-sell rail click (24h anonymous vid bridge)
  ip: string | null;
  device: string | null;
  createdAt: string;
};

export type StoreOffer = {
  code: string;
  label: string | null;
  type: string; // percent | fixed
  value: number;
  minSubtotal: number;
  endsAt?: string | null;
  remaining?: number | null;
};

export type TrackedOrder = {
  orderNumber: string;
  customerName: string;
  customerAddress: string | null;
  items: { id: string; name: string; quantity: number; price: number }[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: string;
  cancelRequested?: boolean;
  cancelRequestedAt?: string | null;
  couponCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoreCategory = {
  id: string | number;
  slug: string;
  name: string;
  nameAr: string;
  imageUrl?: string | null;
  sortOrder?: number;
  visible?: boolean;
};

export const ADMIN_PERMISSIONS = [
  "products.read", "products.write", "products.delete", "prices.write",
  "orders.read", "orders.write", "customers.read",
  "settings.read", "settings.write", "media.read", "media.write",
  "homepage.write", "analytics.read", "ai.use", "ai.execute",
  "users.read", "users.write", "roles.write", "audit.read", "backup.export",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const CATEGORY_LABELS_AR: Record<string, string> = {
  Makeup: "مكياج",
  Skincare: "عناية بالبشرة",
  Fragrance: "عطور",
  "Body Care": "عناية بالجسم",
  Eyes: "عيون",
  Lips: "شفايف",
  Sets: "مجموعات",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  shipped: "تم الشحن",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const WHATSAPP_NUMBER = "201000000000";
export const FREE_SHIPPING_THRESHOLD = 900;
export const SHIPPING_FEE = 60;
