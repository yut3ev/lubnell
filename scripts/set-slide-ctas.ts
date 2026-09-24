/**
 * U10-CTAFIX restore — re-applies real category hrefs to the hero slides.
 * Idempotent + conditional: ONLY rewrites href when it is '/' or '' (never
 * overrides an owner-set link). Run: bun run scripts/set-slide-ctas.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const MAP: Record<string, string> = {
  'skin-edit': '/c/skincare',
  'soft-glow': '/c/body-care',
  'soft-ritual': '/c/sets',
};

async function main() {
  const slides = await db.heroSlide.findMany();
  for (const s of slides) {
    const target = MAP[s.id];
    if (!target) continue;
    if (s.href === '/' || s.href === '') {
      await db.heroSlide.update({ where: { id: s.id }, data: { href: target } });
      console.log(`updated ${s.id}: '${s.href}' -> ${target}`);
    } else {
      console.log(`kept ${s.id}: ${s.href} (owner-set)`);
    }
  }
}

main().finally(() => process.exit(0));
