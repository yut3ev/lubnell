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

const r2ObjectUrl = (key: string) =>
  `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}`;

/** Custom domain or public r2.dev base → visitors fetch straight from the
 * Cloudflare edge (Range/seek included for free). Without it, /api/uploads
 * proxies the object through this server — also with Range passthrough. */
export function r2PublicUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_BASE;
  return base ? `${base.replace(/\/+$/, '')}/${key}` : null;
}

export async function r2Put(
  key: string,
  body: BodyInit,
  contentType: string,
  contentLength?: number
): Promise<void> {
  const res = await r2Client().fetch(r2ObjectUrl(key), {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': contentType,
      ...(contentLength ? { 'Content-Length': String(contentLength) } : {}),
    },
  });
  if (!res.ok) throw new Error(`R2 put failed (${res.status})`);
}

export async function r2Delete(key: string): Promise<void> {
  await r2Client().fetch(r2ObjectUrl(key), { method: 'DELETE' });
}

/** GET an object with Range passthrough (video seek works through the proxy). */
export async function r2Get(key: string, range?: string | null): Promise<Response> {
  return r2Client().fetch(r2ObjectUrl(key), {
    method: 'GET',
    headers: range ? { Range: range } : {},
  });
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
