/* Shared admin helpers — client-safe, no server imports. */

export type AdminInfo = {
  id?: string;
  username: string;
  displayName: string;
  role: string;
  permissions?: string[];
};

export const EGP = (v: number) =>
  `${new Intl.NumberFormat('ar-EG').format(Math.round(v))} ج.م`;

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(iso));

export const orderNo = (id: string, real?: string | null) =>
  real || `LN-${id.slice(-6).toUpperCase()}`;

export const STATUS_LABEL: Record<string, string> = {
  pending: 'جديد',
  confirmed: 'مؤكد',
  shipped: 'تم الشحن',
  delivered: 'مكتمل',
  cancelled: 'ملغي',
};

// U23-ANALYTICS — owner-specified badge language: جديد برتقالي، مؤكد أخضر،
// تم الشحن أزرق، ملغي أحمر (مكتمل keeps a distinct teal-green).
export const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  shipped: 'bg-sky-100 text-sky-800 border-sky-200',
  delivered: 'bg-teal-100 text-teal-800 border-teal-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
};

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

/* ---- admin session token (localStorage fallback for cookie-blocked contexts)
 * Embedded preview iframes with strict third-party-cookie blocking never
 * return the session cookie, so the login response's token is stored here
 * and sent as `x-admin-token` on every admin API call instead. */
const ADMIN_TOKEN_KEY = 'lubnel_admin_token';

export function saveAdminToken(token: string) {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    /* storage unavailable (sandboxed iframe) — cookie path still works */
  }
}

export function loadAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearAdminToken() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* noop */
  }
}

export async function apiJson<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const token = loadAdminToken();
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-admin-token': token } : {}),
      ...(init?.headers || {}),
    },
  });
  let data = null as T;
  try {
    data = (await res.json()) as T;
  } catch {
    /* non-JSON */
  }
  return { ok: res.ok, status: res.status, data };
}
