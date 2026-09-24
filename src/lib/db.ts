import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __lubnelDbReady?: Promise<void>
}

// U83-HOSTING — dual-mode database: local/VPS keeps the SQLite file exactly as
// before, while Turso (libSQL) is enabled by setting TURSO_DB_URL +
// DATABASE_AUTH_TOKEN. NOTE: DATABASE_URL stays a `file:` value in BOTH modes
// (Prisma validates its protocol even when a driver adapter owns the real
// connection) — on Vercel it's a harmless `file:./dev.db` placeholder.
function makeClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DB_URL;
  if (tursoUrl) {
    // adapter v6 takes a CONFIG object (it builds its own libsql client)
    return new PrismaClient({
      adapter: new PrismaLibSQL({ url: tursoUrl, authToken: process.env.DATABASE_AUTH_TOKEN }),
    });
  }
  return new PrismaClient();
}

// U54-PERF-ROBUST — the client is cached on globalThis in EVERY environment
// (previously dev-only): accidental double-imports / module re-evaluation must
// never spawn a second connection pool against the same SQLite file.
export const db =
  globalForPrisma.prisma ??
  makeClient()

globalForPrisma.prisma = db

// U54-PERF-ROBUST — SQLite concurrency hardening («مستعد لكذا مستخدم ويستحمل ضغط»):
// 1) journal_mode=WAL → readers never block the writer and vice versa; a page
//    view can be tracked while an order writes, with zero SQLITE_BUSY between
//    them. Persistent in the DB file; re-asserted idempotently on every boot.
// 2) busy_timeout=5000 → under write contention a statement waits politely up
//    to 5s instead of throwing "database is locked" at a visitor. Reliable at
//    the connection level because DATABASE_URL pins connection_limit=1 (a
//    single pooled connection → the pragma always reaches the live conn).
// 3) synchronous=NORMAL → the WAL-appropriate durability level; much faster
//    writes with the same crash safety the storefront needs.
// 4) PRAGMA optimize → cheap per-boot query-planner statistics maintenance.
// Every pragma failure is swallowed: the store keeps running on SQLite's
// defaults rather than erroring at users.
if (!globalForPrisma.__lubnelDbReady) {
  globalForPrisma.__lubnelDbReady = (async () => {
    for (const pragma of [
      'PRAGMA journal_mode=WAL;',
      'PRAGMA busy_timeout=5000;',
      'PRAGMA synchronous=NORMAL;',
      'PRAGMA optimize;',
    ]) {
      try {
        await db.$queryRawUnsafe(pragma)
      } catch {
        // never block the storefront on pragmas
      }
    }
  })()
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
// U10-DIAG: touched to force stale-module invalidation (pre-restore compiled graph was serving a prisma extension with AND 1=1 that no longer exists in source)

// U80 — fold the WAL into the main DB file: called right after every admin
// save / order so a committed edit never lives only in the -wal side file
// (which a killed dev server, disk cleaner, or workspace restore can lose).
export function checkpointWal(): void {
  db.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);').catch(() => undefined);
}
