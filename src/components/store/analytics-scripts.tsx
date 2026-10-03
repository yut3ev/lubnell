'use client';

// ANALYTICS-2026-10 — Meta Pixel + GA4 loaders driven from the Studio store
// card (store settings → metaPixelId / ga4Id). Nothing is injected while the
// ids are unset, and each script mounts at most once per page lifetime.
import { useEffect } from 'react';
import { useStorePrefs } from '@/lib/store-prefs';

interface PixelFn {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
}

export function AnalyticsScripts() {
  const metaPixelId = useStorePrefs((s) => s.metaPixelId);
  const ga4Id = useStorePrefs((s) => s.ga4Id);
  const ensure = useStorePrefs((s) => s.ensure);

  useEffect(() => {
    void ensure();
  }, [ensure]);

  // Meta Pixel
  useEffect(() => {
    if (!metaPixelId) return;
    const w = window as unknown as { fbq?: PixelFn; _fbq?: PixelFn };
    if (w.fbq) return;
    const n = ((...args: unknown[]) => {
      if (n.callMethod) n.callMethod(...args);
      else n.queue.push(args);
    }) as PixelFn;
    n.queue = [];
    n.loaded = true;
    n.version = '2.0';
    n.push = n;
    w.fbq = n;
    w._fbq = n;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    n('init', metaPixelId);
    n('track', 'PageView');
  }, [metaPixelId]);

  // GA4
  useEffect(() => {
    if (!ga4Id) return;
    const w = window as unknown as { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };
    if (w.gtag) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
    document.head.appendChild(s);
    w.dataLayer = w.dataLayer || [];
    const gtag = (...args: unknown[]) => {
      w.dataLayer?.push(args);
    };
    w.gtag = gtag;
    gtag('js', new Date());
    gtag('config', ga4Id);
  }, [ga4Id]);

  return null;
}
