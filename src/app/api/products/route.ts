import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/* SEARCH-FUZZY-2026-10 — Arabic-normalized, typo-tolerant scoring in JS.
   The old Prisma `contains` match missed hamza/ya/ta-marbuta variants and
   every typo («بلسمم» / «احمر» for «أحمر»). The catalog is small, so all
   published products are scored in memory: exact/prefix/substring weights,
   plus per-token fuzzy (Levenshtein ≤ 1 short words, ≤ 2 long ones). */

function normalizeAr(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // harakat + tatweel
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

function tokenMatch(token: string, target: string): number {
  if (target === token) return 3;
  if (target.startsWith(token)) return 2.5;
  if (target.includes(token)) return 2;
  const tolerance = token.length >= 6 || target.length >= 6 ? 2 : 1;
  if (token.length >= 3 && levenshtein(token, target) <= tolerance) return 1.2;
  return 0;
}

function scoreProduct(p: { nameAr: string; nameEn: string; description?: string | null; category?: { nameAr?: string; nameEn?: string } | null }, qNorm: string): number {
  const name = normalizeAr(`${p.nameAr} ${p.nameEn || ''}`);
  const cat = normalizeAr(`${p.category?.nameAr || ''} ${p.category?.nameEn || ''}`);
  const desc = normalizeAr(p.description || '');
  let score = 0;
  for (const token of qNorm.split(' ').filter(Boolean)) {
    let best = 0;
    // best match across name words, category words, then description substring
    for (const w of name.split(' ')) best = Math.max(best, tokenMatch(token, w) * 2);
    best = Math.max(best, tokenMatch(token, name));
    for (const w of cat.split(' ')) best = Math.max(best, tokenMatch(token, w));
    if (desc.includes(token)) best = Math.max(best, 0.8);
    if (best === 0) return 0; // every token must land somewhere
    score += best;
  }
  return score;
}

export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get('category') || undefined;
    const q = req.nextUrl.searchParams.get('q') || undefined;

    const products = await db.product.findMany({
      where: {
        published: true,
        ...(category ? { category: { slug: category } } : {}),
      },
      include: { category: { select: { slug: true, nameAr: true, nameEn: true } } },
      orderBy: { createdAt: 'asc' },
    });

    let result = products;
    if (q && q.trim()) {
      const qNorm = normalizeAr(q);
      result = products
        .map((p) => ({ p, s: scoreProduct(p, qNorm) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.p);
    }

    return NextResponse.json({ ok: true, products: result });
  } catch (err) {
    console.error('[products]', err);
    return NextResponse.json(
      { ok: false, error: 'failed to list products' },
      { status: 500 }
    );
  }
}
