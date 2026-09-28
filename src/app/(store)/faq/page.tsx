import type { Metadata } from 'next';
import { loadFaqContent, InfoPageBody } from '../info/[slug]/page';
import { siteUrl } from '@/lib/site-url';

// GEO — canonical FAQ page at /faq (was /info/faq). Same rendering machinery,
// plus FAQPage structured data so the Q&As are eligible for rich results and
// AI answer engines (GPTBot/PerplexityBot/ClaudeBot are allowed in robots).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة | LUBNÉL',
  description:
    'كل ما تريدين معرفته عن لوبنيل: التوصيل لكل محافظات مصر خلال 2–5 أيام، الدفع عند الاستلام، التغليف المجاني للهدايا، أصالة المنتجات، وسياسة الاستبدال خلال 14 يوم.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'الأسئلة الشائعة | LUBNÉL',
    description:
      'التوصيل، الدفع عند الاستلام، التغليف المجاني، الأصالة، والاستبدال — إجابات مباشرة عن كل ما يخص طلبك من لوبنيل.',
    type: 'article',
  },
};

export default async function FaqPage() {
  const { pairs } = await loadFaqContent();
  const base = siteUrl();
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map((p) => ({
      '@type': 'Question',
      name: p.q,
      acceptedAnswer: { '@type': 'Answer', text: p.a },
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        // Same stored-XSS hardening as the Product schema: escape "<" so an
        // owner-edited answer can never break out of the ld+json block.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqLd).replace(/</g, '\\u003c'),
        }}
      />
      <InfoPageBody slug="faq" />
    </>
  );
}
