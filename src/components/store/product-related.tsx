'use client';

import { useT } from '@/lib/i18n';

export function ProductRelated({ headingAr, headingEn }: { headingAr: string; headingEn: string }) {
  const { ar } = useT();
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xl font-extrabold">{ar ? headingAr : headingEn}</h2>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}
