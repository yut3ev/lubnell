// U83 — upload every existing MediaAsset's bytes to R2 so the bucket becomes
// the canonical store before the Vercel deploy. Prefers the disk file, falls
// back to the legacy DB blob. Idempotent: re-running just re-uploads.
// Usage: bun scripts/upload-media-to-r2.ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { db } from './db';
import { r2Configured, r2Put } from '../src/lib/r2';

async function main() {
  if (!r2Configured()) {
    console.log('R2 not configured — aborting');
    process.exit(1);
  }
  const assets = await db.mediaAsset.findMany({ orderBy: { createdAt: 'asc' } });
  console.log('assets:', assets.length);
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const a of assets) {
    const disk = path.join('public', a.storageKey);
    let bytes: Uint8Array | null = null;
    if (existsSync(disk)) bytes = new Uint8Array(readFileSync(disk));
    else if (a.data && a.data.length > 0) bytes = new Uint8Array(a.data);
    if (!bytes || bytes.length === 0) {
      console.log('SKIP (no bytes anywhere):', a.storageKey);
      skipped++;
      continue;
    }
    try {
      await r2Put(a.storageKey, bytes, a.mimeType || 'application/octet-stream', bytes.length);
      console.log('UPLOADED:', a.storageKey, `(${bytes.length} bytes)`);
      ok++;
    } catch (e) {
      console.log('FAIL:', a.storageKey, String(e).slice(0, 150));
      failed++;
    }
  }
  console.log(`done — uploaded ${ok}, skipped ${skipped}, failed ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
