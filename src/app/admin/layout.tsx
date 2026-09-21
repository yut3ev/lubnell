import type { ReactNode } from 'react';
import { getThemeCss } from '@/lib/theme-server';

// U29-THEME-STUDIO — the admin panel follows the same global theme as the
// storefront: the resolved CSS variables are injected server-side before
// first paint, so Studio/Dashboard surfaces (cards, buttons, sidebar…)
// re-theme together with the site — one identity everywhere.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const themeCss = await getThemeCss();
  return (
    <>
      {themeCss ? (
        <style href="lubnel-theme-v2" precedence="high" dangerouslySetInnerHTML={{ __html: themeCss }} />
      ) : null}
      {children}
    </>
  );
}
