'use client';

// U67-ANIMATED-ICON — shared home for the owner's animated webm icon clips:
// the three trust-strip icons (U65-TRUST-VIDEO) and the contact-page
// YouTube card (U67-YOUTUBE-SOCIAL). All clips are VP8 + alpha
// (transparent background), muted autoplay loop. Decorative: aria-hidden,
// pointer-events off, keyboard-focusable off — and paused for
// prefers-reduced-motion users.
import { useEffect, useRef } from 'react';

export function TrustVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // React does not render the muted attribute — set the property
    // explicitly so iOS Safari allows autoplay.
    v.muted = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause();
    }
  }, []);
  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
      className={`pointer-events-none select-none ${className ?? ''}`}
    />
  );
}
