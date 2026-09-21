'use client';

// U18-BANNER — terracotta brand banner. U21-BANNER — rebuilt to the owner's
// exact target screenshot (brave_spfuKiOqTj.png): horizontal composition —
// copy block at inline-start (chip «AI STYLIST · مساعدة ذكية», title
// «محتارة في اختيار هدية؟ اسألي لُو», body) and the white pill CTA
// «اسألي لُو الآن» with its caption «مجاني · ترد عالي خلال لحظات» on the
// inline-end (left side in RTL), like her artwork.
// U22-EXACT — second pass over her artwork: body wording «تفهم الهدية»,
// chat icon on the far side of the pill text, caption aligned to the pill's
// inline-start edge, larger title, and the thin ring circle she draws top-left.
// U47-MAROON-BANNER — the owner rejected the salmon terracotta (its hex
// #bd6b50→#b0543a read «بوني»/brownish next to the site): the banner now
// wears the BRAND PRIMARY deep maroon (#8e3d43 — her swatch, the same color
// as the announcement bar). The gradient, CTA text, shadow and focus ring
// all ride var(--primary) via color-mix, so Studio theme changes propagate
// and dark mode stays coherent. Professional pass: glass hairline chip,
// soft top sheen for depth, quieter decorative rings, maroon-tinted shadow.
import { MessageCircleHeart } from 'lucide-react';
import { useT } from '@/lib/i18n';

export function AiStylistBanner({
  media,
}: {
  /** U22 — وسائط بانر الدعوة from Studio (optional image/video behind the gradient) */
  media?: { image?: string; video?: string };
}) {
  const { ar, t } = useT(); // U51-GLOBAL-TEXTS — Lou banner copy is owner-editable

  const openLou = () => window.dispatchEvent(new CustomEvent('open-lou'));

  return (
    <section aria-labelledby="lou-banner-title">
      <button
        type="button"
        onClick={openLou}
        aria-label={
          ar
            ? 'محتارة في اختيار هدية؟ اسألي لُو — المساعدة الذكية'
            : 'Not sure what to gift? Ask Lou — our smart assistant'
        }
        className="group relative block w-full cursor-pointer overflow-hidden rounded-3xl text-start text-primary-foreground shadow-xl shadow-primary/25 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [-webkit-tap-highlight-color:transparent]"
        style={{
          // U47 — brand maroon sweep: lighter at the copy corner, core primary
          // mid, deeper at the far corner (theme-aware via --primary).
          background:
            'linear-gradient(215deg, color-mix(in oklab, var(--primary) 84%, white) 0%, var(--primary) 46%, color-mix(in oklab, var(--primary) 88%, black) 100%)',
        }}
      >
        {/* U47 — owner media behind the maroon gradient (video wins) */}
        {(media?.video || media?.image) && (
          <div className="absolute inset-0" aria-hidden>
            {media?.video ? (
              <video
                src={media.video}
                poster={media.image || undefined}
                muted
                loop
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <img src={media!.image} alt="" className="h-full w-full object-cover" />
            )}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(215deg, color-mix(in oklab, var(--primary) 80%, white) 0%, color-mix(in oklab, var(--primary) 72%, transparent) 48%, color-mix(in oklab, var(--primary) 90%, black) 100%)',
              }}
            />
          </div>
        )}
        {/* U47 professional pass — soft top sheen (depth) + her thin ring
            sweeping the top-inline arc + one quiet glow low, nothing busy */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute -top-24 -left-12 h-72 w-72 rounded-full border border-white/15" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-white/5" aria-hidden />

        {/* U21 — her composition: copy right, CTA + caption left */}
        <div className="relative flex flex-col gap-6 px-6 py-9 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-10 sm:py-11">
          {/* copy block — inline-start (right in RTL) */}
          <div className="max-w-2xl">
            <span
              dir="ltr"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3.5 py-1 text-[10px] font-bold tracking-[0.2em] text-white/95 backdrop-blur-sm sm:text-[11px]"
            >
              AI STYLIST
              <span aria-hidden className="h-1 w-1 rounded-full bg-white/70" />
              <bdi>{t.louChip}</bdi>
            </span>
            <h2
              id="lou-banner-title"
              className="mt-3 text-[1.35rem] font-extrabold leading-snug tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)] sm:text-[2.35rem]"
            >
              {t.louTitle}
            </h2>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/85 sm:text-[15px]">
              {t.louDesc}
            </p>
          </div>

          {/* CTA column — inline-end (left in RTL), like the reference.
              U22-EXACT — icon sits on the far side of the text (physical left
              in RTL) and the caption shares the pill's inline-start edge. */}
          <div className="flex shrink-0 flex-col items-center gap-2 self-start sm:items-start sm:self-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[rgb(253,246,242)] px-6 py-3 text-sm font-bold text-primary shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-active:scale-95">
              <bdi>{t.louCta}</bdi>
              <MessageCircleHeart className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="text-[11px] font-semibold text-white/80">
              {t.louSub}
            </span>
          </div>
        </div>
      </button>
    </section>
  );
}
