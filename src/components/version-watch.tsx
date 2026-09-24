'use client';

import { useEffect } from 'react';

// U23-BOOTID — the aria-controls hydration error the owner keeps hitting is
// pure version skew: her tab stays open across a server restart (dev revival
// / deploy) and then pairs fresh HTML with STALE JS whose useId sequence no
// longer matches. The console.error autoheal (extension-shield) reacts AFTER
// the error; this watchdog PREVENTS it: a tiny /api/health/boot probe returns
// an id that changes only when the server PROCESS restarts. If the tab sees
// a change (60s interval + on visibility) it reloads itself once BEFORE any
// mismatch can render. 15s throttle = no reload loops.
export function VersionWatch() {
  useEffect(() => {
    const KEY = 'lubnel_boot_id';
    const THROTTLE = 'lubnel_boot_reload';
    let stopped = false;

    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/health/boot', { cache: 'no-store' });
        if (!res.ok) return;
        const id = String((await res.json()).bootId ?? '');
        if (!id) return;
        const prev = sessionStorage.getItem(KEY);
        if (!prev) {
          sessionStorage.setItem(KEY, id);
          return;
        }
        if (prev !== id) {
          const last = Number(sessionStorage.getItem(THROTTLE) ?? 0);
          if (Date.now() - last > 15000) {
            sessionStorage.setItem(THROTTLE, String(Date.now()));
            sessionStorage.setItem(KEY, id);
            window.location.reload();
          }
        }
      } catch {
        // server unreachable → nothing smarter to do than wait for the net poll
      }
    };

    void check();
    const iv = window.setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => {
      stopped = true;
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return null;
}
