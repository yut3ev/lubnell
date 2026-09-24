'use client';

// VISITS-1 — storefront visit tracker (fire-and-forget, never breaks the UX).
// Mounts once in the (store) layout; logs a page_view for every route change
// and exposes trackVisit() for explicit actions (add-to-cart, order placed…).

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SID_KEY = 'lubnel_sid';

function getSessionId(): string {
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(SID_KEY, sid);
    }
    // UUIDs contain dashes — allowed by the API's [A-Za-z0-9_-] check
    return sid.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  } catch {
    return ''; // sandboxed storage — skip tracking rather than crash
  }
}

export function trackVisit(action = 'page_view', detail?: string) {
  try {
    const sid = getSessionId();
    if (!sid) return;
    const payload = JSON.stringify({
      sid,
      path: window.location.pathname.slice(0, 300),
      action,
      detail: detail?.slice(0, 300),
    });
    // keepalive lets the request survive page navigations (e.g. order → WhatsApp)
    void fetch('/api/store/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* tracking must never break the storefront */
  }
}

// PERF (2-c): module-level dedupe — guarantees at most one page_view POST per
// path per page view (guarding remounts/StrictMode double-effects), while
// explicit actions (order_placed, add-to-cart…) still post every time.
let lastTrackedPath: string | null = null;

export default function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (lastTrackedPath === pathname) return;
    lastTrackedPath = pathname;
    trackVisit('page_view');
  }, [pathname]);
  return null;
}
