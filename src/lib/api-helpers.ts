// Shared API helpers: JSON responses, admin guard, product mapping
import { NextResponse } from "next/server";
import { getAdminFromRequest, permissionsFor, requestMeta, writeAudit, type RequestMeta } from "@/lib/admin-auth";
import type { AdminUser } from "@prisma/client";
import { db } from "@/lib/db";

export const jsonOk = <T>(data: T, init?: ResponseInit) => NextResponse.json(data as object, init);
export const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export type AdminContext = { admin: AdminUser; permissions: string[]; meta: RequestMeta; req: Request };

/* SEC-AUDIT-2 — CSRF origin guard for state-changing admin requests.
 * The admin session cookie is SameSite=None+Secure under https (required for
 * the embedded preview iframe), which means a malicious third-party page CAN
 * fire cookie-carrying cross-site POSTs at /api/admin/*. Responses are not
 * readable by the attacker (no CORS), but writes would land. Browsers always
 * attach Origin on cross-site POST/PUT/PATCH/DELETE, so rejecting mismatched
 * origins kills classic CSRF. Non-browser clients (curl/server-to-server)
 * send no Origin → skipped (they are not CSRF-able; they still need the
 * session token itself). Allowlist is deliberately generous with FIRST-PARTY
 * hosts only: the request's own host (dev :3000, preview origins) plus the
 * platform edge hosts (space-z.ai / fcapp.run) seen in U23/U31 — because the
 * forwarded Host can be an internal deploy host while the browser Origin is
 * the official domain. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FIRST_PARTY_ORIGIN_RE = /(^|\.)space-z\.ai$|(^|\.)fcapp\.run$|^localhost$|^127\.0\.0\.1$/;

export function csrfOriginOk(req: Request): boolean {
  if (!MUTATING_METHODS.has(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser / same-origin GET-style client
  try {
    const originHost = new URL(origin).hostname.toLowerCase();
    const hostHeader = (req.headers.get("host") || "").split(":")[0].toLowerCase();
    if (originHost === hostHeader) return true;
    if (FIRST_PARTY_ORIGIN_RE.test(originHost)) return true;
  } catch {
    return false; // malformed Origin on a mutating request → reject
  }
  return false;
}

export async function requireAdmin(req: Request, permission?: string | string[]): Promise<AdminContext | null> {
  // CSRF guard runs BEFORE session resolution so a forged cross-site write
  // never even reaches the token check.
  if (!csrfOriginOk(req)) return null;
  const admin = await getAdminFromRequest(req);
  if (!admin) return null;
  const permissions = permissionsFor(admin);
  // U22-TEAM-PERMS — permission may be a single key OR a list of acceptable
  // keys (any-of). Sections that used to piggyback on legacy keys keep working
  // while new dedicated keys (theme.*, content.*, visits.read, dashboard.read)
  // also unlock them.
  if (Array.isArray(permission)) {
    if (permission.length > 0 && !permission.some((p) => permissions.includes(p))) return null;
  } else if (permission && !permissions.includes(permission)) return null;
  return { admin, permissions, meta: requestMeta(req), req };
}

export async function audit(ctx: AdminContext, action: string, entity: string, entityId?: string, _metadata?: unknown) {
  try {
    // actor must be the username STRING — passing the admin object made every
    // Prisma write throw (swallowed by .catch) and silently dropped ALL
    // studio CRUD audit rows. Fixed SUP-8.
    await writeAudit({ actor: ctx.admin?.username ?? null, action, entity, entityId, meta: ctx.meta });
  } catch {
    // audit failures must never break the request
  }
}

export function parseBody<T>(req: Request): Promise<T> {
  return req.json() as Promise<T>;
}

export function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 120) || `item-${Date.now()}`;
}
