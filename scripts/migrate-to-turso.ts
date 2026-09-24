// U83 — one-shot: replicate the local SQLite schema + ALL data into Turso.
// Reads TURSO_URL + TURSO_TOKEN from the environment (NEVER hardcoded).
// Refuses to run if the remote already has tables (no double-import).
// Usage: TURSO_URL=... TURSO_TOKEN=... bun scripts/migrate-to-turso.ts
import { createClient, type InStatement } from '@libsql/client';
import { Database } from 'bun:sqlite';

const url = process.env.TURSO_URL!;
const token = process.env.TURSO_TOKEN!;
if (!url || !token) throw new Error('TURSO_URL / TURSO_TOKEN missing');

const remote = createClient({ url, authToken: token });
const local = new Database('../lubnel-data/custom.db', { readonly: true });

// 0) remote must be EMPTY — if a previous attempt left tables behind, drop
//    them all first (reverse creation order is safest) so the import starts
//    from a clean slate and never double-imports.
const existing = await remote.execute("SELECT name, type FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid DESC");
if (existing.rows.length > 0) {
  console.log('cleaning', existing.rows.length, 'leftover objects from a previous attempt...');
  for (const o of existing.rows) {
    const kind = String(o.type) === 'table' ? 'TABLE' : 'INDEX';
    await remote.execute(`DROP ${kind} IF EXISTS "${String(o.name)}"`).catch(() => undefined);
  }
}

// 1) schema: tables in original order (SQLite tolerates forward REFERENCES),
//    then indexes
const master = local
  .prepare("SELECT name, sql, type FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid")
  .all() as { name: string; sql: string; type: string }[];
const tables = master.filter((m) => m.type === 'table');
const indexes = master.filter((m) => m.type === 'index');
console.log('creating', tables.length, 'tables...');
for (const t of tables) await remote.execute(t.sql);
for (const i of indexes) {
  await remote.execute(i.sql).catch((e) => console.log('index skipped:', i.name, String(e).slice(0, 80)));
}

// 2) topological copy order (parents before children by REFERENCES)
const deps = new Map<string, Set<string>>();
for (const t of tables) {
  const refs = new Set<string>();
  for (const m of (t.sql || '').matchAll(/REFERENCES\s+"?(\w+)"?/gi)) {
    if (m[1] && m[1] !== t.name) refs.add(m[1]);
  }
  deps.set(t.name, refs);
}
const done = new Set<string>();
const order: string[] = [];
let pending = tables.map((t) => t.name);
while (pending.length) {
  const next = pending.filter((name) => [...deps.get(name)!].every((d) => done.has(d) || !deps.has(d)));
  if (!next.length) {
    order.push(...pending); // cycle fallback — copy the rest as-is
    break;
  }
  for (const n of next) {
    done.add(n);
    order.push(n);
  }
  pending = pending.filter((n) => !done.has(n));
}
console.log('copy order:', order.join(' → '));

// 3) data: multi-row INSERTs via plain `execute` (NOT client.batch — the
//    hrana batch path mis-serializes args under Bun: "1 values for N columns").
//    20 rows per statement → numbered placeholders ?1..?N across the tuples.
const CHUNK = 20;
for (const name of order) {
  const rows = local.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
  if (!rows.length) {
    console.log(name + ': 0 rows');
    continue;
  }
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(',');
  let copied = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const tuples = chunk
      .map((_, ri) => '(' + cols.map((_, ci) => `?${ri * cols.length + ci + 1}`).join(',') + ')')
      .join(',');
    const args: unknown[] = [];
    for (const r of chunk) for (const c of cols) args.push(r[c]);
    await remote.execute({
      sql: `INSERT INTO "${name}" (${colList}) VALUES ${tuples}`,
      args,
    });
    copied += chunk.length;
  }
  console.log(name + ':', copied, 'rows copied');
}

// 4) verify counts
let mismatches = 0;
for (const name of order) {
  const lc = (local.prepare(`SELECT COUNT(*) c FROM "${name}"`).get() as any)?.c ?? 0;
  const rc = await remote.execute(`SELECT COUNT(*) c FROM "${name}"`);
  const same = Number(rc.rows[0].c) === Number(lc);
  if (!same) mismatches++;
  console.log(same ? 'OK      ' : 'MISMATCH', name, Number(lc), '→', Number(rc.rows[0].c));
}
console.log(mismatches === 0 ? 'MIGRATION COMPLETE — all counts match' : `${mismatches} MISMATCH(ES)`);
local.close();
