import { Skeleton } from '@/components/ui/skeleton';

/**
 * Branded loading UI for all (store) routes — shimmer hero + skeleton
 * sections matching the real homepage layout, so the swap feels seamless.
 */
export default function StoreLoading() {
  return (
    <div className="flex flex-1 flex-col pb-16" aria-busy="true">
      {/* brand pulse — U16-BRAND: owner's wordmark */}
      <div className="flex items-center justify-center pt-10" aria-hidden>
        <img
          src="/brand/logo-dark.png"
          alt="LUBNÉL"
          className="h-8 w-auto animate-pulse object-contain opacity-80"
          draggable={false}
        />
      </div>

      {/* hero */}
      <div className="mx-4 mt-8 sm:mx-6" aria-hidden>
        <Skeleton className="skeleton-shimmer h-[300px] w-full rounded-[2rem] sm:h-[420px]" />
      </div>

      {/* trust strip */}
      <div className="mx-auto mt-10 grid w-full max-w-6xl grid-cols-3 gap-4 px-4 sm:px-6" aria-hidden>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          </div>
        ))}
      </div>

      {/* categories */}
      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6" aria-hidden>
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer aspect-[4/3] rounded-2xl" />
          ))}
        </div>
      </div>

      {/* product grid */}
      <div className="mx-auto mt-12 w-full max-w-6xl px-4 sm:px-6" aria-hidden>
        <Skeleton className="h-8 w-56" />
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border/60">
              <Skeleton className="skeleton-shimmer aspect-square rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">جارٍ تحميل لوبنيل…</span>
    </div>
  );
}
