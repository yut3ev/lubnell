import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// U23-BOOTID — one id per server PROCESS lifetime. globalThis survives dev
// module reloads (HMR) but resets when the process restarts, so a changed
// bootId means the tab's JS predates the running server (revival / deploy)
// → the VersionWatch client refreshes the tab before React ever hydrates
// against mismatched markup (the recurring aria-controls radix-ID error).
export const dynamic = 'force-dynamic';

export function GET() {
  const g = globalThis as typeof globalThis & { __LUBNEL_BOOT_ID?: string };
  if (!g.__LUBNEL_BOOT_ID) g.__LUBNEL_BOOT_ID = randomUUID();
  return NextResponse.json(
    { ok: true, bootId: g.__LUBNEL_BOOT_ID },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
