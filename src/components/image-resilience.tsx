'use client';

// U7 — global image resilience, mounted once in the root layout.
//
// Owner report (18 Sep): uploaded images sometimes showed as a broken-image
// icon on the site even though the files existed and served 200 (verified
// file-by-file). The one untestable link is the owner's preview chain
// (embedded iframe → platform proxy): a <img> URL that fails once — e.g. the
// visitor loaded the page in the seconds between the DB save and the file
// write, or a middle proxy pinned the early 404 — can stay broken forever
// from that browser because the stale miss is cached for that exact URL.
//
// So every <img> on the site now recovers by itself:
//   Stage 1 — first error → ONE retry with a cache-busting query (?r=…),
//             which bypasses any stale 404 cached for the bare URL.
//   Stage 2 — second error → swap to the branded placeholder instead of
//             ever showing the browser's broken-image glyph.
// dataset flags make the pipeline strictly one-shot (no reload loops).
// Error events from <img> do not bubble, but they ARE capturable — hence the
// capture-phase document listener, which also covers images rendered later
// (dialogs, galleries, client swaps) with zero per-component wiring.

import { useEffect } from 'react';

const PLACEHOLDER = '/products/placeholder-box.svg';

export default function ImageResilience() {
  useEffect(() => {
    const onErr = (e: Event) => {
      const img = e.target as HTMLImageElement | null;
      if (!img || img.tagName !== 'IMG') return;
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:') || src === PLACEHOLDER) return;
      if (img.dataset.imgStage === 'fallback') return;

      if (img.dataset.imgStage !== 'retried') {
        img.dataset.imgStage = 'retried';
        const sep = src.includes('?') ? '&' : '?';
        img.src = `${src}${sep}r=${Date.now()}`;
        return;
      }

      img.dataset.imgStage = 'fallback';
      img.style.objectFit = 'contain';
      img.src = PLACEHOLDER;
    };
    document.addEventListener('error', onErr, true);
    return () => document.removeEventListener('error', onErr, true);
  }, []);

  return null;
}
