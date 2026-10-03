import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseVariants } from '@/lib/lubnel-types';
import { siteUrl } from '@/lib/site-url';

// GOOGLE-SHOPPING-FEED-2026-10 — Merchant Center products feed generated
// straight from the live catalog. Submit https://lubnel.vercel.app/google-feed.xml
// in Google Merchant Center for free Shopping listings. Plain escaped XML only
// (no DOCTYPE/ENTITY — external entities are never used or parsed).
export const dynamic = 'force-dynamic';

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const abs = (u: string) => (u?.startsWith('http') ? u : `${siteUrl()}${u || ''}`);
const strip = (s: string) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function item(id: string, title: string, description: string, link: string, image: string, price: number, stock: number, groupId: string | null): string {
  return `  <item>
    <g:id>${esc(id)}</g:id>
    <g:title>${esc(title.slice(0, 150))}</g:title>
    <g:description>${esc(description.slice(0, 4900))}</g:description>
    <link>${esc(link)}</link>
    <g:image_link>${esc(abs(image))}</g:image_link>
    <g:condition>new</g:condition>
    <g:availability>${stock > 0 ? 'in stock' : 'out of stock'}</g:availability>
    <g:price>${price.toFixed(2)} EGP</g:price>
    <g:brand>LUBNÉL</g:brand>
${groupId ? `    <g:item_group_id>${esc(groupId)}</g:item_group_id>\n` : ''}  </item>`;
}

export async function GET() {
  let xml: string;
  try {
    const products = await db.product.findMany({
      where: { published: true },
      include: { category: true },
    });

    const chunks: string[] = [];
    for (const p of products) {
      const link = `${siteUrl()}/p/${p.slug}`;
      const description = strip(p.description || p.nameAr);
      const groups = parseVariants(p.variants);
      if (groups.length === 0) {
        chunks.push(item(p.id, p.nameAr, description, link, p.image, p.price, p.stock, null));
      } else {
        chunks.push(item(p.id, p.nameAr, description, link, p.image, p.price, p.stock, p.id));
        for (const g of groups) {
          for (const o of g.options) {
            chunks.push(
              item(
                `${p.id}-${o.value}`,
                `${p.nameAr} — ${o.value}`,
                description,
                link,
                o.image || p.image,
                p.price,
                p.stock,
                p.id
              )
            );
          }
        }
      }
    }

    xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>LUBNÉL — لوبنيل</title>
<link>${esc(siteUrl())}</link>
<description>جمالٌ يُهدى بكل حب — عناية بالبشرة والشعر ومكياج وأبوكسات هدايا.</description>
${chunks.join('\n')}
</channel>
</rss>`;
  } catch {
    xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n<title>LUBNÉL</title>\n</channel>\n</rss>`;
  }
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800' },
  });
}
