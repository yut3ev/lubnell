'use client';

// U58-GALLERY — fullscreen image viewer shared by the PDP gallery and the
// category gallery strip («بشكل احترافي ف الجزء الخاص بيهم»).
//   • Esc / ← / → keyboard navigation (RTL-aware: ArrowRight = previous in RTL)
//   • touch swipe (RTL-aware: swipe right = next image in RTL)
//   • counter chip + thumbnail strip + click-outside close
//   • body scroll lock while open

import { useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useT } from '@/lib/i18n';

export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
  alt = '',
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  alt?: string;
}) {
  const { ar, t } = useT();
  const count = images.length;
  const touchX = useRef<number | null>(null);

  const prev = useCallback(() => onIndexChange((index - 1 + count) % count), [index, count, onIndexChange]);
  const next = useCallback(() => onIndexChange((index + 1) % count), [index, count, onIndexChange]);

  // keyboard + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // RTL: images flow right→left, so ArrowRight means "previous"
      else if (e.key === 'ArrowRight') (ar ? prev : next)();
      else if (e.key === 'ArrowLeft') (ar ? next : prev)();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [ar, next, onClose, prev]);

  if (count === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ar ? 'عرض الصور بالحجم الكامل' : 'Full-size image viewer'}
      className="fixed inset-0 z-[70] flex flex-col bg-foreground/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* top bar — counter + close */}
      <div className="relative flex items-center justify-between p-4 text-background">
        <span className="rounded-full bg-background/15 px-3 py-1 text-xs font-bold tabular-nums" aria-live="polite">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.lbCloseAria}
          className="grid h-11 w-11 place-items-center rounded-full bg-background/15 transition-colors hover:bg-background/30"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* main image */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          if (start === null) return;
          const dx = e.changedTouches[0]?.clientX - start;
          if (Math.abs(dx) < 40) return;
          // RTL: swiping right reveals the next image (visual flow right→left)
          if (ar ? dx > 0 : dx < 0) next();
          else prev();
        }}
      >
        <img
          key={images[index]}
          src={images[index]}
          alt={alt ? `${alt} — ${index + 1}` : `Image ${index + 1}`}
          className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />

        {/* arrows — desktop */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                (ar ? prev : next)();
              }}
              aria-label={ar ? t.lbPrevAria : t.lbNextAria}
              className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-background/15 text-background transition-all hover:scale-110 hover:bg-background/30"
            >
              <ChevronRight className="h-6 w-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                (ar ? next : prev)();
              }}
              aria-label={ar ? t.lbNextAria : t.lbPrevAria}
              className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-background/15 text-background transition-all hover:scale-110 hover:bg-background/30"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
          </>
        )}
      </div>

      {/* thumbnails */}
      {count > 1 && (
        <div className="shrink-0 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((img, i) => (
              <button
                key={img + i}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`${ar ? 'صورة' : 'Image'} ${i + 1}`}
                aria-pressed={i === index}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                  i === index ? 'border-primary-foreground opacity-100' : 'border-transparent opacity-50 hover:opacity-90'
                }`}
              >
                <img src={img} alt="" aria-hidden className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
