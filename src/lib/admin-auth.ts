import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { clientIpFromHeaders } from '@/lib/client-ip';

export const ADMIN_SESSION_COOKIE = 'lubnel_admin_session';
export const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h, mirrors original

export const ADMIN_PERMISSIONS = [
  'orders.read',
  'orders.write',
  'orders.delete', // U79 — «حذف الطلبات» أصبح صلاحية قابلة للمنح (كانت Owner فقط)
  'products.read',
  'products.write',
  'products.delete',
  'categories.read',
  'categories.write',
  'coupons.read',
  'coupons.write',
  'coupons.delete', // U22 — «حذف العروض» chip from her permissions screenshot
  'users.read',
  'users.write',
  'audit.read',
  // SUP-6 full-panel permission keys
  'customers.read',
  'media.read',
  'media.write',
  'homepage.read',
  'homepage.write',
  'pages.read',
  'pages.write',
  'reviews.read',
  'reviews.write',
  // U13 — section-texts editor (النصوص والأقسام) was 401ing even for the
  // owner because these keys were missing from the catalog entirely
  'sections.read',
  'sections.write',
  'analytics.read',
  'settings.read',
  'settings.write',
  'ai.use',
  'ai.execute',
  // U22-TEAM-PERMS — the owner asked for the team permission editor to cover
  // «الاوبشن واعدادات والتفاصيل والصلاحيات الي موجوده ف الادمن بالكامل» —
  // every panel section gets its own honest keys instead of piggybacking:
  'dashboard.read', // نظرة عامة (stats endpoint was previously unguarded!)
  'visits.read', // سجل الزيارات (was audit.read)
  'theme.read', // الثيم والألوان (was settings.read)
  'theme.write',
  'content.read', // النصوص والفوتر (was settings.read)
  'content.write',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AdminRecord = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  permissions: string | null;
  active: boolean;
};

/* ---------- hashing ---------- */

export function hashSecret(value: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(value, salt, 32).toString('hex')}`;
}

export function verifySecret(value: string, encoded: string): boolean {
  const [salt, stored] = encoded.split(':');
  if (!salt || !stored) return false;
  const derived = scryptSync(value, salt, 32);
  const expected = Buffer.from(stored, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export const tokenDigest = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/* ---------- permissions ---------- */

export function permissionsFor(admin: Pick<AdminRecord, 'role' | 'permissions'>): string[] {
  if (admin.role === 'owner') return [...ADMIN_PERMISSIONS];
  try {
    const parsed = JSON.parse(admin.permissions || '[]') as string[];
    return parsed.filter((p) => (ADMIN_PERMISSIONS as readonly string[]).includes(p));
  } catch {
    return [];
  }
}

export function can(admin: AdminRecord & { perms?: string[] }, permission: string): boolean {
  const perms = admin.perms ?? permissionsFor(admin);
  return perms.includes(permission);
}

/* ---------- request meta ---------- */

// U13 — parse device class + human label from the user-agent so the visits
// log shows «Safari on iPhone / موبايل» style rows instead of blanks.
export function parseDevice(userAgent: string | null | undefined): { device: string; deviceLabel: string } {
  const ua = userAgent || '';
  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua);
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Mac OS X/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Unknown OS';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\//i.test(ua)
      ? 'Opera'
      : /Chrome\//i.test(ua)
        ? 'Chrome'
        : /Safari\//i.test(ua) && /Version\//i.test(ua)
          ? 'Safari'
          : /Firefox\//i.test(ua)
            ? 'Firefox'
            : 'Browser';
  return { device: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop', deviceLabel: `${browser} on ${os}` };
}

export function requestMeta(req: Request) {
  const userAgent = req.headers.get('user-agent') || 'unknown';
  // U23-REALIP — real visitor IP via lib/client-ip (platform edge `remoteip`
  // header / public-first x-forwarded-for). The old code stored the gateway's
  // own hop IP (21.0.0.1) for every visitor.
  return { ip: clientIpFromHeaders(req.headers), userAgent, ...parseDevice(userAgent) };
}

/* ---------- session helpers ---------- */

export async function getAdminFromToken(token: string | undefined | null) {
  if (!token) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: tokenDigest(token) },
    include: { admin: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // U23 — a revoked session (owner ended it from the sessions log) must stop
  // authenticating immediately; the row stays only as history.
  if (session.endedAt) return null;
  if (!session.admin.active) return null;
  return session.admin;
}

/** Extract the admin session token from a request: cookie first, then
 * `x-admin-token` / `Authorization: Bearer` headers. The header fallback
 * keeps the panel usable where browsers drop cookies entirely (embedded
 * preview iframes with strict third-party-cookie blocking). */
export function tokenFromRequest(req: Request): string | undefined {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([k, v]) => k && v !== undefined)
      .map(([k, v]) => [k, decodeURIComponent(v as string)])
  );
  const fromCookie = cookies[ADMIN_SESSION_COOKIE];
  if (fromCookie) return fromCookie;
  const header = req.headers.get('x-admin-token');
  if (header) return header.trim();
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return undefined;
}

/** Resolve the admin from a Next API Request (cookie or token header). */
export async function requireAdmin(req: Request): Promise<AdminRecord | null> {
  const admin = await getAdminFromToken(tokenFromRequest(req));
  if (!admin) return null;
  return { ...admin, perms: permissionsFor(admin) } as AdminRecord & { perms: string[] };
}

export async function writeAudit(entry: {
  actor?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  meta?: { ip?: string; userAgent?: string };
}) {
  await db.adminAudit
    .create({
      data: {
        actor: entry.actor ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        ip: entry.meta?.ip ?? null,
        userAgent: entry.meta?.userAgent ?? null,
      },
    })
    .catch(() => undefined);
}

/* ---------- owner bootstrap ---------- */

export async function hasOwner(): Promise<boolean> {
  const rows = await db.adminUser.findMany({ where: { role: 'owner' }, take: 1 });
  return rows.length > 0;
}

export function validateCredentials(input: {
  username: string;
  password: string;
  verificationCode: string;
}) {
  if (!/^[a-zA-Z0-9_.-]{3,80}$/.test(input.username.trim())) throw new Error('INVALID_USERNAME');
  if (input.password.length < 8) throw new Error('PASSWORD_TOO_SHORT');
  const code = input.verificationCode.trim();
  if (code.length < 4 || code.length > 32) throw new Error('INVALID_VERIFICATION_CODE');
}

/* ---------- login session layer (rebuilt during outage recovery) ----------
 * The pre-wipe session/login implementation (loginAdmin, createOwner,
 * destroyAdminSession, getAdminFromRequest, AdminLockoutError) was lost in the
 * sandbox wipe; only the primitives above survived. This rebuild restores the
 * contract the admin auth route imports, using those same primitives:
 * scrypt password/code hashes, sha256 token digests, DB-backed AdminSession
 * rows. Lockout is an in-memory sliding window (5 fails / 15 min per username
 * and per IP, R97 refusal semantics preserved). Documented in the worklog. */

export class AdminLockoutError extends Error {
  lockedBy: 'username' | 'ip' | 'both';
  retryAfterSeconds: number;
  constructor(lockedBy: 'username' | 'ip' | 'both', retryAfterSeconds: number) {
    super('ADMIN_LOCKED');
    this.name = 'AdminLockoutError';
    this.lockedBy = lockedBy;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, number[]>();

function recordAttempt(key: string, now: number) {
  const recent = (loginAttempts.get(key) || []).filter((t) => now - t < LOCKOUT_WINDOW_MS);
  recent.push(now);
  loginAttempts.set(key, recent);
}

function lockedRetry(key: string, now: number): number | null {
  const recent = (loginAttempts.get(key) || []).filter((t) => now - t < LOCKOUT_WINDOW_MS);
  if (recent.length < LOCKOUT_MAX_ATTEMPTS) return null;
  const retry = Math.ceil((LOCKOUT_WINDOW_MS - (now - recent[0])) / 1000);
  return retry > 0 ? retry : null;
}

function cookieToken(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name && rest.length) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/** Resolve the admin from a Next API Request (cookie header). */
export async function getAdminFromRequest(req: Request): Promise<AdminRecord | null> {
  return requireAdmin(req);
}

export async function createOwner(
  input: { username: string; displayName: string; password: string; verificationCode: string },
  meta: { ip: string; userAgent: string; device?: string },
): Promise<AdminRecord> {
  if (await hasOwner()) throw new Error('OWNER_ALREADY_EXISTS');
  validateCredentials(input);
  try {
    const admin = await db.adminUser.create({
      data: {
        username: input.username.trim(),
        displayName: input.displayName.trim() || input.username.trim(),
        passwordHash: hashSecret(input.password),
        verificationCodeHash: hashSecret(input.verificationCode),
        role: 'owner',
      },
    });
    await writeAudit({
      actor: admin.username,
      action: 'owner.created',
      entity: 'admin_user',
      entityId: admin.id,
      meta: { ip: meta.ip, userAgent: meta.userAgent },
    });
    return admin as AdminRecord;
  } catch (e) {
    if (e instanceof Error && e.message === 'OWNER_ALREADY_EXISTS') throw e;
    throw new Error('DATABASE_UNAVAILABLE');
  }
}

export async function loginAdmin(
  input: { username: string; password: string; verificationCode: string },
  meta: { ip: string; userAgent: string; device?: string },
): Promise<{ token: string; admin: AdminRecord }> {
  const username = input.username.trim();
  const now = Date.now();
  const retryU = lockedRetry(`u:${username.toLowerCase()}`, now);
  const retryI = lockedRetry(`i:${meta.ip}`, now);
  if (retryU !== null || retryI !== null) {
    const lockedBy = retryU !== null && retryI !== null ? 'both' : retryU !== null ? 'username' : 'ip';
    throw new AdminLockoutError(lockedBy, Math.max(retryU ?? 0, retryI ?? 0));
  }

  let admin: (AdminRecord & { passwordHash: string; verificationCodeHash: string }) | null = null;
  try {
    admin = await db.adminUser.findUnique({ where: { username } });
  } catch {
    throw new Error('DATABASE_UNAVAILABLE');
  }

  const ok =
    !!admin &&
    admin.active &&
    verifySecret(input.password, admin.passwordHash) &&
    verifySecret(input.verificationCode, admin.verificationCodeHash);
  if (!ok) {
    recordAttempt(`u:${username.toLowerCase()}`, now);
    recordAttempt(`i:${meta.ip}`, now);
    throw new Error('INVALID_CREDENTIALS');
  }

  loginAttempts.delete(`u:${username.toLowerCase()}`);
  loginAttempts.delete(`i:${meta.ip}`);

  const token = randomBytes(32).toString('hex');
  try {
    await db.adminSession.create({
      data: {
        tokenHash: tokenDigest(token),
        adminUserId: admin.id,
        expiresAt: new Date(now + ADMIN_SESSION_TTL_MS),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date(now) } });
    await writeAudit({
      actor: admin.username,
      action: 'admin.login',
      entity: 'admin_user',
      entityId: admin.id,
      meta: { ip: meta.ip, userAgent: meta.userAgent },
    });
  } catch {
    throw new Error('DATABASE_UNAVAILABLE');
  }
  return { token, admin: admin as AdminRecord };
}

export async function destroyAdminSession(req: Request): Promise<void> {
  const token = cookieToken(req, ADMIN_SESSION_COOKIE);
  if (!token) return;
  await db.adminSession
    .delete({ where: { tokenHash: tokenDigest(token) } })
    .catch(() => undefined);
}

// U23-DEPLOY-FIX — the sessions route (owner revoking a team session) imports
// this; the U22-TEAM-PERMS refactor dropped the helper and the dangling
// import broke the production build (`Export endSessionById doesn't exist` —
// the direct cause of the failed deploys). Ends a session by id but KEEPS
// the row as history (endedAt + endedReason), matching the route's contract.
export async function endSessionById(id: string, reason: string): Promise<void> {
  await db.adminSession
    .update({ where: { id }, data: { endedAt: new Date(), endedReason: reason } })
    .catch(() => undefined);
}

// U10-DIAG: touched to force stale-module invalidation (see db.ts note)
