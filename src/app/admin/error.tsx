'use client';

// U54-PERF-ROBUST — the admin studio gets its own error boundary so a crashed
// dashboard view never shows the default English error screen to the owner.
// Recovery: retry the segment, hard reload, or hop back to the dashboard root.

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, RefreshCw, LayoutDashboard } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin-error]', error?.digest ?? error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-14" dir="rtl">
      <div
        role="alert"
        className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 text-center shadow-sm"
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <span className="text-3xl" aria-hidden="true">🛠️</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          حصلت مشكلة في لوحة التحكم
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          الجزء ده من اللوحة ما اشتغلش. بياناتك محفوظة — جرّبي تاني أو حدّثي
          الصفحة.
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
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            تحديث الصفحة
          </button>
        </div>
        <Link
          href="/admin"
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
          العودة للوحة
        </Link>
      </div>
    </div>
  );
}
