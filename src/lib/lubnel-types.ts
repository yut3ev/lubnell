// Shared LUBNÉL types (client + server safe)

export type Variant = { label: string; value: string; price?: number; image?: string; color?: string; kind?: string };

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
