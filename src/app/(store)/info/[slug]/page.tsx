import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageCircle, Truck, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { getSettingsRows, getSettingRow } from '@/lib/settings-cache'; // U54-PERF-ROBUST
import { resolveSiteTexts, type SiteTexts } from '@/lib/site-texts';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, WHATSAPP_NUMBER } from '@/lib/constants';
import {
  DEFAULT_FAQ_PAIRS_AR,
  DEFAULT_FAQ_PAIRS_EN,
  DEFAULT_INFO_PAGES,
  SHIPPING_REGIONS,
  SHIPPING_STEPS,
  faqPairsFromText,
  isInfoSlug,
} from '@/lib/info-pages';
import {
  ContactPanel,
  FaqAccordion,
  InfoHeader,
  InfoProse,
  ShippingPanel,
} from '@/components/store/info-panels';

export const dynamic = 'force-dynamic';

// U2 (task 2-a) — storefront info-page renderer. Every built-in slug renders
// shipped professional AR+EN defaults from lib/info-pages; an admin entry in
// StoreSettings key "pages" (Studio → «الصفحات») overrides the defaults.
// Unknown slugs 404.

type StoredPage = {
  slug?: string;
  titleAr?: string;
  titleEn?: string;
  contentAr?: string;
  contentEn?: string;
};

type StoreSettingsBag = {
  custom?: StoredPage;
  waDigits: string;
  texts: SiteTexts;
};

function parseStoredPages(raw: string | null | undefined): StoredPage[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? (parsed as StoredPage[]) : [];
  } catch {
    return [];
  }
}

async function loadSettingsBag(slug: string): Promise<StoreSettingsBag> {
  // U52 fix — start from the SHIPPED defaults (resolveSiteTexts(null)), not an
  // empty bag: with no «texts» row in the DB the old {} init silently dropped
  // every default (owner's IG/FB links, hours, location…) on info pages.
  const bag: StoreSettingsBag = { waDigits: WHATSAPP_NUMBER.replace(/[^0-9]/g, ''), texts: resolveSiteTexts(null) };
  try {
    // U54-PERF-ROBUST — served from the settings TTL cache (invalidated on
    // admin saves); this batch is read on every info-page render + metadata.
    const rows = await getSettingsRows(['pages', 'store', 'texts']);
    for (const row of rows) {
      if (row.key === 'pages') {
        const list = parseStoredPages(row.value);
        bag.custom = list.find(
          (p) => p?.slug === slug && Boolean(p.titleAr?.trim() || p.contentAr?.trim())
        );
      } else if (row.key === 'store') {
        try {
          const s = JSON.parse(row.value) as { whatsappNumber?: string };
          const digits = typeof s.whatsappNumber === 'string' ? s.whatsappNumber.replace(/[^0-9]/g, '') : '';
          if (digits) bag.waDigits = digits;
        } catch {
          /* keep default WhatsApp */
        }
      } else if (row.key === 'texts') {
        try {
          bag.texts = resolveSiteTexts(JSON.parse(row.value));
        } catch {
          /* keep empty texts */
        }
      }
    }
  } catch {
    // DB unavailable → shipped defaults, never block the storefront
  }
  return bag;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isInfoSlug(slug)) return {};
  const base = DEFAULT_INFO_PAGES[slug];
  let title = base.titleAr;
  let description = base.descAr;
  try {
    const row = await getSettingRow('pages');
    const custom = parseStoredPages(row?.value).find(
      (p) => p?.slug === slug && Boolean(p.titleAr?.trim() || p.contentAr?.trim())
    );
    if (custom) {
      if (custom.titleAr?.trim()) title = custom.titleAr.trim();
      if (custom.contentAr?.trim()) {
        description = custom.contentAr.trim().split('\n')[0].slice(0, 155);
      }
    }
  } catch {
    // defaults are fine for metadata
  }
  return {
    title: `${title} | LUBNÉL`,
    description,
    alternates: { canonical: `/info/${slug}` },
    openGraph: { title: `${title} | LUBNÉL`, description, type: 'article' },
  };
}

const RELATED: { slug: string; labelAr: string; labelEn: string; Icon: typeof Truck }[] = [
  { slug: 'shipping', labelAr: 'الشحن والتوصيل', labelEn: 'Shipping & delivery', Icon: Truck },
  { slug: 'returns', labelAr: 'الاستبدال والإرجاع', labelEn: 'Returns & exchange', Icon: RotateCcw },
  { slug: 'faq', labelAr: 'الأسئلة الشائعة', labelEn: 'FAQ', Icon: ShieldCheck },
  { slug: 'contact', labelAr: 'تواصلي معنا', labelEn: 'Contact us', Icon: MessageCircle },
  { slug: 'about', labelAr: 'عن لوبنيل', labelEn: 'About LUBNÉL', Icon: Sparkles },
];

export default async function InfoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isInfoSlug(slug)) notFound();
  const base = DEFAULT_INFO_PAGES[slug];
  const bag = await loadSettingsBag(slug);

  const custom = bag.custom;
  const titleAr = custom?.titleAr?.trim() || base.titleAr;
  const titleEn = custom?.titleEn?.trim() || base.titleEn;
  const contentAr = custom?.contentAr?.trim() ? custom.contentAr : base.contentAr;
  const contentEn = custom?.contentEn?.trim() ? custom.contentEn : base.contentEn;
  const isCustom = Boolean(custom?.contentAr?.trim());

  // FAQ: admin "سؤال\nجواب" text becomes accordion pairs; freeform prose falls
  // back to paragraph rendering; empty settings use the shipped 8 Q&A.
  let faqArPairs = DEFAULT_FAQ_PAIRS_AR;
  let faqEnPairs: typeof DEFAULT_FAQ_PAIRS_EN | undefined = DEFAULT_FAQ_PAIRS_EN;
  if (isCustom && slug === 'faq') {
    const parsed = faqPairsFromText(contentAr);
    if (parsed.length >= 2) {
      faqArPairs = parsed;
      faqEnPairs = contentEn.trim() ? faqPairsFromText(contentEn) : undefined;
    } else {
      faqArPairs = [];
    }
  }

  const t = bag.texts;

  return (
    // U62-CONTACT-COMPACT — owner: «فيه فراغ كبير… صغر الكلام شويه علشان
    // سكرول المستخدم ميطلاعش لتحت». Page frame tightened on mobile so the
    // contact panel (WA CTA + channels) lands inside the first viewport.
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
      <InfoHeader titleAr={titleAr} titleEn={titleEn} />

      {/* U59-SEO-ABOUT — brand hero with keyword-rich alt (لوبنيل/LUBNÉL):
          the page previously had zero images, so crawlers got no image signal. */}
      {slug === 'about' && (
        <figure className="mt-8 overflow-hidden rounded-3xl border border-border/60 shadow-sm">
          <Image
            src="/og-image.jpg"
            alt="لوبنيل LUBNÉL — متجر إلكتروني مصري لبيع مستحضرات التجميل والعناية والعطور الأصلية أونلاين"
            width={1200}
            height={630}
            sizes="(max-width: 640px) 100vw, 768px"
            className="h-auto w-full object-cover"
          />
        </figure>
      )}

      {slug === 'contact' && (
        <ContactPanel
          waDigits={bag.waDigits}
          hoursAr={t.hoursAr?.trim() || 'يوميًا من 10 صباحًا حتى 10 مساءً'}
          hoursEn={t.hoursEn?.trim() || 'Daily 10 AM – 10 PM'}
          locationAr={t.locationAr?.trim() || 'القاهرة، مصر'}
          locationEn={t.locationEn?.trim() || 'Cairo, Egypt'}
          instagramUrl={t.instagramUrl?.trim() || undefined}
          facebookUrl={t.facebookUrl?.trim() || undefined}
          whatsappChannelUrl={t.whatsappChannelUrl?.trim() || undefined}
          tiktokUrl={t.tiktokUrl?.trim() || undefined}
          youtubeUrl={t.youtubeUrl?.trim() || undefined}
        />
      )}

      <div className="mt-7">
        {slug === 'faq' && faqArPairs.length >= 2 ? (
          <FaqAccordion itemsAr={faqArPairs} itemsEn={faqEnPairs} />
        ) : slug === 'shipping' ? (
          // factual store data (regions / fees / steps) always renders as a
          // structured panel; prose above is the customizable narrative part
          <div className="space-y-8">
            <InfoProse ar={contentAr} en={contentEn} />
            <ShippingPanel
              regions={SHIPPING_REGIONS}
              steps={SHIPPING_STEPS}
              fee={SHIPPING_FEE}
              freeThreshold={FREE_SHIPPING_THRESHOLD}
            />
          </div>
        ) : (
          <InfoProse ar={contentAr} en={contentEn} />
        )}
      </div>

      {/* cross-links to sibling info pages */}
      <nav
        aria-label="صفحات ذات صلة / Related pages"
        className="mt-9 grid gap-3 sm:grid-cols-3"
      >
        {RELATED.filter((r) => r.slug !== slug)
          .slice(0, 3)
          .map(({ slug: rel, labelAr, labelEn, Icon }) => (
            <Link
              key={rel}
              href={`/info/${rel}`}
              className="flex min-h-[48px] items-center gap-2.5 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm font-bold transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Icon className="h-4.5 w-4.5 shrink-0 text-primary" aria-hidden />
              <span>{labelAr} · {labelEn}</span>
            </Link>
          ))}
      </nav>
    </div>
  );
}
