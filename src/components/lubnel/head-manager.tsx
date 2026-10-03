"use client";

// R24 — dynamic head manager for the hash-routed SPA.
// Keeps document.title + meta description in sync with the current view and
// language, and maintains a single JSON-LD graph (Organization + WebSite,
// plus a Product node while a product page is open) for search engines.

import { useEffect } from "react";
import type { Product, RatingSummary } from "@/lib/lubnel-types";

type HeadRoute = { view: string; id?: string; page?: string };

type ViewMeta = { title: [string, string]; desc: [string, string] }; // [ar, en]

const BRAND = "LUBNÉL";

const VIEW_META: Record<string, ViewMeta> = {
  home: {
    title: [`${BRAND} — جمالكِ اليومي من القاهرة`, `${BRAND} — Premium Beauty, Cairo`],
    desc: [
      "مكياج وعناية بالبشرة وعطور وأطقم مختارة — توصيل لكل مصر مع الدفع عند الاستلام.",
      "Makeup, skincare, fragrance and curated beauty sets — delivered across Egypt with cash on delivery.",
    ],
  },
  shop: {
    title: [`المتجر — ${BRAND}`, `Shop — ${BRAND}`],
    desc: [
      "تسوّقي المجموعة الكاملة: مكياج، عناية بالبشرة، عطور، وأطقم — مع فلاتر وترتيب حسب الأحدث والأكثر مبيعًا.",
      "Browse the full collection: makeup, skincare, fragrance and sets — filter and sort by newest or best sellers.",
    ],
  },
  cart: {
    title: [`حقيبتكِ — ${BRAND}`, `Your bag — ${BRAND}`],
    desc: [
      "راجعي طلبكِ واطلبي مباشرة عبر واتساب — شحن مجاني للطلبات فوق 1000 ج.م.",
      "Review your order and check out directly via WhatsApp — free delivery over 1000 EGP.",
    ],
  },
  wishlist: {
    title: [`المفضلة — ${BRAND}`, `Wishlist — ${BRAND}`],
    desc: [
      "منتجاتكِ المحفوظة في مكان واحد — أضيفيها إلى الحقيبة متى ما جهزتِ.",
      "Your saved products in one place — add them to your bag whenever you're ready.",
    ],
  },
  track: {
    title: [`تتبعي طلبكِ — ${BRAND}`, `Track your order — ${BRAND}`],
    desc: [
      "تابعي حالة طلبكِ برقم هاتفكِ — من التأكيد حتى التوصيل إلى بابكِ.",
      "Follow your order status with your phone number — from confirmation to your doorstep.",
    ],
  },
  // R62 — the not-found view owns its title too: a lost link no longer
  // renders home's title while the URL claims elsewhere.
  "not-found": {
    title: [`الصفحة غير موجودة — ${BRAND}`, `Page not found — ${BRAND}`],
    desc: [
      "الرابط الذي فتحتِه لا يقود لأي مكان هنا — تسوّقي المجموعة أو عودي إلى الرئيسية.",
      "The link you opened doesn't lead anywhere here — browse the shop or head back home.",
    ],
  },
  "static:about": {
    title: [`قصتنا — ${BRAND}`, `Our story — ${BRAND}`],
    desc: [
      "بدأت LUBNÉL من القاهرة: مساحة للجمال اليومي — ناعمة، واثقة، ومصرية بطريقتها الخاصة.",
      "LUBNÉL began in Cairo: space for everyday beauty — soft, confident, and distinctly our own.",
    ],
  },
  "static:contact": {
    title: [`تواصلي معنا — ${BRAND}`, `Contact — ${BRAND}`],
    desc: [
      "فريقنا متاح من السبت إلى الخميس، 10 صباحًا – 10 مساءً — راسلينا وسنرد خلال ساعات العمل.",
      "Our team is available Sat–Thu, 10am–10pm — message us and we'll reply within working hours.",
    ],
  },
  "static:faq": {
    title: [`الأسئلة الشائعة — ${BRAND}`, `FAQ — ${BRAND}`],
    desc: [
      "كل ما تريدين معرفته: التوصيل 2–5 أيام عمل، الدفع عند الاستلام، والإرجاع خلال 14 يومًا.",
      "Everything you need to know: 2–5 day delivery, cash on delivery, and 14-day returns.",
    ],
  },
  "static:shipping": {
    title: [`الشحن والتوصيل — ${BRAND}`, `Shipping — ${BRAND}`],
    desc: [
      "توصيل لكل مصر خلال 2–5 أيام عمل — مجانًا للطلبات فوق 1000 ج.م و60 ج.م لما دونها.",
      "Nationwide delivery in 2–5 business days — free over 1000 EGP, 60 EGP below that.",
    ],
  },
  "static:returns": {
    title: [`الاستبدال والإرجاع — ${BRAND}`, `Returns — ${BRAND}`],
    desc: [
      "إرجاع أو استبدال خلال 14 يومًا للمنتجات غير المفتوحة — نساعدكِ خطوة بخطوة عبر واتساب.",
      "Return or exchange unopened products within 14 days — we'll guide you step by step on WhatsApp.",
    ],
  },
  "static:account": {
    title: [`حسابي — ${BRAND}`, `Account — ${BRAND}`],
    desc: [
      "تابعي طلباتكِ وتواصلي معنا مباشرة عبر واتساب — من الاختيار حتى التوصيل.",
      "Follow your orders and reach us directly on WhatsApp — from discovery to delivery.",
    ],
  },
};

function upsertMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertJsonLd(id: string, graph: object[]) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

export function HeadManager({
  route,
  lang,
  products,
  ratings,
}: {
  route: HeadRoute;
  lang: "ar" | "en";
  products: Product[];
  ratings: Record<string, RatingSummary>;
}) {
  const idx = lang === "ar" ? 0 : 1;

  const routeKey = `${route.view}:${route.id || route.page || ""}`;
  const viewMeta =
    route.view === "static"
      ? VIEW_META[`static:${route.page}`]
      : VIEW_META[route.view];

  useEffect(() => {
    const applyHead = () => {
      const product =
        route.view === "product"
          ? products.find((p) => p.id === route.id)
          : undefined;
      const rating = product ? ratings[product.id] : undefined;

      // 1) Title + description per view (product view gets the product name)
      if (product) {
        const name = idx === 0 ? product.nameAr || product.name : product.name;
        document.title = `${name} — ${BRAND}`;
        const shortDesc =
          product.description.length > 160
            ? `${product.description.slice(0, 157)}…`
            : product.description;
        upsertMeta("description", shortDesc);
      } else if (viewMeta) {
        document.title = viewMeta.title[idx];
        upsertMeta("description", viewMeta.desc[idx]);
      }

      // 2) JSON-LD graph — Organization + WebSite always, Product on product view
      const origin = window.location.origin;
      const graph: object[] = [];
      graph.push(
        {
          "@type": "Organization",
          "@id": `${origin}/#org`,
          name: BRAND,
          url: `${origin}/`,
          logo: `${origin}/icon.svg`,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Cairo",
            addressCountry: "EG",
          },
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            availableLanguage: ["Arabic", "English"],
          },
        },
        {
          "@type": "WebSite",
          "@id": `${origin}/#site`,
          name: BRAND,
          url: `${origin}/`,
          inLanguage: idx === 0 ? "ar-EG" : "en",
          publisher: { "@id": `${origin}/#org` },
        },
      );

      if (product) {
        const image = product.images?.[0]
          ? `${origin}${product.images[0]}`
          : `${origin}/og-image.jpg`;
        graph.push({
          "@type": "Product",
          name: idx === 0 ? product.nameAr || product.name : product.name,
          description: product.description,
          image,
          sku: product.id,
          brand: { "@type": "Brand", name: BRAND },
          offers: {
            "@type": "Offer",
            url: `${origin}/#/product/${encodeURIComponent(product.id)}`,
            price: product.price.toFixed(2),
            priceCurrency: "EGP",
            availability:
              product.stock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
          ...(rating && rating.count > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: rating.average.toFixed(1),
                  reviewCount: rating.count,
                },
              }
            : {}),
        });
      }

      upsertJsonLd("lubnel-jsonld", graph);
    };

    applyHead();
    // Next.js hydration can re-assert the SSR <title> node after effects run —
    // re-apply deterministically (idempotent, cheap) to win the race.
    const timers = [120, 400, 1200, 3000, 6000].map((ms) =>
      window.setTimeout(applyHead, ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [routeKey, route.view, route.id, route.page, idx, viewMeta, products, ratings]);

  return null;
}
