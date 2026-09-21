import { headers } from "next/headers";
import { db } from "@/lib/db";
import type { StoreProduct, StoreCategory } from "@prisma/client";

// R25/R26 — shared helpers for the /p/[id] and /c/[slug] share routes.

export async function shareOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function findShareProduct(id: string): Promise<StoreProduct | null> {
  const numeric = Number(id);
  return db.storeProduct.findFirst({
    where: {
      OR: [{ slug: id }, ...(Number.isFinite(numeric) ? [{ id: numeric }] : [])],
      visible: true,
    },
  });
}

// R26 — category deep links: visible category by slug + its live product count
export async function findShareCategory(
  slug: string,
): Promise<{ category: StoreCategory; count: number } | null> {
  const category = await db.storeCategory.findFirst({
    where: { slug, visible: true },
  });
  if (!category) return null;
  const count = await db.storeProduct.count({
    where: { category: category.name, visible: true, stock: { gt: 0 } },
  });
  return { category, count };
}
