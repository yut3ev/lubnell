// Shared Prisma client for the QA scripts — mirrors src/lib/db.ts's dual-mode:
// TURSO_DB_URL set → libSQL adapter (Turso), else the local SQLite file.
// Bun auto-loads .env, so scripts see the same env as the app.
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const g = globalThis as unknown as { __lubnelProbeDb?: PrismaClient };

function makeDb(): PrismaClient {
  const tursoUrl = process.env.TURSO_DB_URL;
  if (tursoUrl) {
    // adapter v6 takes a CONFIG object (it builds its own libsql client)
    return new PrismaClient({
      adapter: new PrismaLibSQL({ url: tursoUrl, authToken: process.env.DATABASE_AUTH_TOKEN }),
    });
  }
  return new PrismaClient();
}

export const db = g.__lubnelProbeDb ?? makeDb();
g.__lubnelProbeDb = db;
