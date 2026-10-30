'use client';

// PUSH-PROMPT-2026-10 — soft, brand-styled permission banner (never the raw
// browser prompt out of nowhere): shows once per ~7 days after a dismiss, only
// when the browser supports push and permission is still 'default'. On enable:
// register /sw.js → request permission → subscribe → POST the subscription.

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

const DISMISS_KEY = 'push_prompt_dismissed_at';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'default') return;
      if (localStorage.getItem('push_subscribed') === '1') return;
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - dismissed < SEVEN_DAYS) return;
      const t = setTimeout(() => setVisible(true), 20000); // soft: 20s after load
      return () => clearTimeout(t);
    } catch {
      /* unsupported browser → stay hidden */
    }
  }, []);

  async function enable() {
    setBusy(true);
    setError('');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setVisible(false);
        return;
      }
      const keyRes = await fetch('/api/push');
      const keyData = await keyRes.json().catch(() => null);
      const publicKey = keyData?.publicKey || '';
      if (!publicKey) throw new Error('no-key');
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      localStorage.setItem('push_subscribed', '1');
      setDone(true);
      setTimeout(() => setVisible(false), 3500);
    } catch {
      setError('تعذر التفعيل — جربي تاني');
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    setVisible(false);
  }

  if (!visible) return null;

  if (done) {
    return (
      <div className="fixed inset-x-3 bottom-20 z-50 sm:inset-x-auto sm:right-6" role="status">
        <div className="flex items-center gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-xl">
          <Bell className="h-5 w-5" />
          <span className="text-sm font-bold">تم التفعيل — هتوصلك الجديد أول واحد 🌸</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-3 bottom-20 z-50 sm:inset-x-auto sm:right-6 sm:w-96"
      role="dialog"
      aria-label="تفعيل إشعارات لوبنيل"
    >
      <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
          </span>
          <div className="flex-1">
            <p className="text-sm font-black leading-snug">فعّلي إشعارات لوبنيل 🔔</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              العروض، المنتجات الجديدة، وأول ما حاجة نفدت تتوفر — يوصلك فورًا حتى من غير ما تفتحي الموقع.
            </p>
          </div>
        </div>
        {error && <p className="mt-2 text-xs font-bold text-destructive">{error}</p>}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={enable}
            disabled={busy}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            <Bell size={15} /> فعّلي الإشعارات
          </button>
          <button
            onClick={dismiss}
            className="flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary"
          >
            <BellOff size={14} /> لاحقًا
          </button>
        </div>
      </div>
    </div>
  );
}
