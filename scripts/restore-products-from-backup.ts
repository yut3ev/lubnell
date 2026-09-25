// U85-RECOVERY — restore products (and their reviews) that were deleted from
// Turso, using the pre-migration local backup as the source of truth.
// Same ids/slugs → old links and order references line up again.
// Usage: bun scripts/restore-products-from-backup.ts
import { createClient } from '@libsql/client';
import { Database } from 'bun:sqlite';

const remote = createClient({ url: process.env.TURSO_DB_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
const backup = new Database('../db-backups/2026-09-24_post-move/custom.db', { readonly: true });

const backupProducts = backup.prepare('SELECT * FROM Product ORDER BY createdAt').all() as Record<string, unknown>[];
const current = new Set(
  (await remote.execute('SELECT slug FROM Product')).rows.map((r) => String(r.slug))
);
const missing = backupProducts.filter((p) => !current.has(String(p.slug)));
console.log('backup products:', backupProducts.length, '| on Turso:', current.size, '| missing:', missing.length);

for (const p of missing) {
  const cols = Object.keys(p);
  const colList = cols.map((c) => `"${c}"`).join(',');
  const placeholders = cols.map((_, i) => `?${i + 1}`).join(',');
  await remote.execute({
    sql: `INSERT INTO "Product" (${colList}) VALUES (${placeholders})`,
    args: cols.map((c) => p[c]),
  });
  console.log('restored product:', p.slug, '—', p.nameAr);
}

// reviews: restore any backup review missing on Turso
const backupReviews = backup.prepare('SELECT * FROM Review').all() as Record<string, unknown>[];
const remoteReviews = new Set(
  (await remote.execute('SELECT id FROM Review')).rows.map((r) => String(r.id))
);
for (const r of backupReviews) {
  if (remoteReviews.has(String(r.id))) continue;
  const cols = Object.keys(r);
  const colList = cols.map((c) => `"${c}"`).join(',');
  const placeholders = cols.map((_, i) => `?${i + 1}`).join(',');
  await remote.execute({
    sql: `INSERT INTO "Review" (${colList}) VALUES (${placeholders})`,
    args: cols.map((c) => r[c]),
  });
  console.log('restored review:', String(r.id).slice(0, 10), '—', String(r.nameAr || r.name || '').slice(0, 40));
}

// final counts
const pc = await remote.execute('SELECT COUNT(*) c FROM Product');
const rc = await remote.execute('SELECT COUNT(*) c FROM Review');
console.log('FINAL — products:', Number(pc.rows[0].c), '| reviews:', Number(rc.rows[0].c));
backup.close();
