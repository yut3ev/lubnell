'use client';

// U54-PERF-ROBUST — store-wide error boundary («ميكونش ف أخطاء تظهر للمستخدمين»).
// Before this file, any render-time failure in a storefront page bubbled to
// Next's default English "Application error" screen — jarring and unbranded.
// Now the visitor gets a friendly Arabic (RTL) card that keeps the store's
// look, with one-tap recovery (retry / home / WhatsApp). The digest is kept
// out of the UI (server logs + console only) so users never see stack noise.

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, Home, MessageCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '@/lib/constants';

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // server-side + dev console visibility without exposing anything to users
    console.error('[store-error]', error?.digest ?? error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-14">
      <div
        role="alert"
        className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 text-center shadow-sm"
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <span className="text-3xl" aria-hidden="true">🛍️</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          حصلت مشكلة مؤقتة
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          الصفحة ما عرضتش بالشكل المطلوب. جرّبي تاني — ولو المشكلة استمرت
          كلّمنا على واتساب وهنظبطها فورًا.
        </p>
        <div className="mt-7 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            إعادة المحاولة
          </button>
          <Link
            href="/"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            العودة للرئيسية
          </Link>
        </div>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          تواصلي معنا على واتساب
        </a>
      </div>
    </div>
  );
}
