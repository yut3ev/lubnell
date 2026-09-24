'use client';

// U25-MOTION — one shared reveal-on-scroll primitive for the storefront.
// The owner: «مفيش أي حركة/animation ظاهرة — كل حاجة static، ودا اللي
// بيخلي الموقع حاسة "بايظ"». Sections and card groups now fade-and-rise
// once as they enter the viewport (IntersectionObserver, disconnects after
// the first reveal). `delay` staggers siblings (e.g. index * 90ms for the
// trust cards). Respects prefers-reduced-motion and renders statically
// visible when IO is unavailable, so content can never get stuck hidden.

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  /** stagger in ms — e.g. index * 90 for sibling cards */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      // defer one frame — keeps the effect free of synchronous setState
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      // start slightly before the section is on screen (-8%) so the rise is
      // already in motion when the user reaches it
      { rootMargin: '0px 0px -8% 0px', threshold: 0.04 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}
