// U83-HOSTING — Cloudflare R2 (S3-compatible) storage for uploaded media.
//
// Activated ONLY when R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY
// + R2_BUCKET are set; otherwise every upload keeps the local-disk path, so
// local dev and the current sandbox behave exactly as before. On Vercel the
// env vars are set once and uploads land in R2 with zero code changes.

import { AwsClient } from 'aws4fetch';

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

function r2Client(): AwsClient {
  return new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  });
}

/** Media keys derive from uploaded filenames (user-influenced), so only
 * URL-inert keys may enter a signed request: reject separators, controls and
 * traversal — any other unicode (Arabic names, spaces) keeps working. */
const MEDIA_KEY_SAFE = /^[^\\/?#%@&+'"<>|`^[\]{}$\x00-\x1f]{1,300}$/;

const R2_HOST = '.r2.cloudflarestorage.com';

const r2ObjectUrl = (key: string): URL => {
  if (key.includes('..') || !MEDIA_KEY_SAFE.test(key)) throw new Error('invalid media key');
  // Cloudflare account ids are 32-hex and buckets follow S3 naming — a
  // hostname assembled only from validated parts can never be redirected.
  const acct = process.env.R2_ACCOUNT_ID ?? '';
  if (!acct.match(/^[a-f0-9]{32}$/)) throw new Error('R2_ACCOUNT_ID must be 32-hex');
  const bucket = process.env.R2_BUCKET ?? '';
  if (!bucket.match(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)) throw new Error('invalid R2_BUCKET');
  const u = new URL('https://r2.cloudflarestorage.com/');
  u.hostname = `${acct}${R2_HOST}`;
  u.pathname = `/${bucket}/${key}`;
  return u;
};

/** Custom domain or public r2.dev base → visitors fetch straight from the
 * Cloudflare edge (Range/seek included for free). Without it, /api/uploads
 * proxies the object through this server — also with Range passthrough. */
export function r2PublicUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_BASE;
  return base ? `${base.replace(/\/+$/, '')}/${key}` : null;
}

/** Sign with aws4fetch, send with global fetch — the same two steps the
 * library's own client.fetch() performs internally. */
async function r2Send(req: Request): Promise<Response> {
  const signed = await r2Client().sign(req);
  return fetch(signed);
}

export async function r2Put(
  key: string,
  body: BodyInit,
  contentType: string,
  contentLength?: number
): Promise<void> {
  const req = new Request(r2ObjectUrl(key), {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': contentType,
      ...(contentLength ? { 'Content-Length': String(contentLength) } : {}),
    },
  });
  const res = await r2Send(req);
  if (!res.ok) throw new Error(`R2 put failed (${res.status})`);
}

export async function r2Delete(key: string): Promise<void> {
  await r2Send(new Request(r2ObjectUrl(key), { method: 'DELETE' }));
}

/** GET an object with Range passthrough (video seek works through the proxy). */
export async function r2Get(key: string, range?: string | null): Promise<Response> {
  return r2Send(new Request(r2ObjectUrl(key), {
    method: 'GET',
    headers: range ? { Range: range } : {},
  }));
}

/** Presigned PUT for direct browser→R2 uploads (bypasses serverless body
 * limits entirely). Phase-2 piece for the Vercel large-video path. */
export async function r2PresignPut(key: string, contentType: string): Promise<string> {
  const req = new Request(r2ObjectUrl(key), {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
  });
  const signed = await r2Client().sign(req, { aws: { signQuery: true } });
  return signed.url;
}
