import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export interface AnnounceMessage {
  id: string;
  icon: 'flower' | 'truck' | 'gift' | 'tag' | 'star';
  text: string;
  href?: string | null;
  active: boolean;
  from?: string | null;
  to?: string | null;
  order: number;
}

export interface AnnounceBarConfig {
  enabled: boolean;
  theme: 'rose' | 'peach' | 'sage' | 'lilac';
  colors: {
    bg?: string | null;
    fg?: string | null;
    hi?: string | null;
    rope?: string | null;
    stem?: string | null;
    flags?: string[];
  };
  intervalMs: number;
  transitionMs: number;
  effect: 'slide' | 'fade';
  flags: boolean;
  flowers: boolean;
  dismissible: boolean;
  rememberDismiss: boolean;
  dismissTtlHours: number;
  showOn: string[];
  messages: AnnounceMessage[];
  version: number;
}

export const DEFAULT_ANNOUNCE_CONFIG: AnnounceBarConfig = {
  enabled: true,
  theme: 'rose',
  colors: { bg: null, fg: null, hi: null, rope: null, stem: null, flags: [] },
  intervalMs: 5000,
  transitionMs: 700,
  effect: 'slide',
  flags: true,
  flowers: true,
  dismissible: true,
  rememberDismiss: true,
  dismissTtlHours: 0,
  showOn: ['*'],
  messages: [
    {
      id: 'msg_1',
      icon: 'flower',
      text: 'أهلًا بكم في لوبنيل — جمال يُهدى بكل حب 🌸',
      href: null,
      active: true,
      from: null,
      to: null,
      order: 1,
    },
    {
      id: 'msg_2',
      icon: 'truck',
      text: 'شحن مجاني للطلبات التي تتجاوز {b}1,500 جنيه{/b}',
      href: '/c/all',
      active: true,
      from: null,
      to: null,
      order: 2,
    },
    {
      id: 'msg_3',
      icon: 'gift',
      text: 'تغليف هدايا مجاني مع كل طلب من لوبنيل 🎁',
      href: null,
      active: true,
      from: null,
      to: null,
      order: 3,
    },
  ],
  version: 1,
};

// Returns current time in Cairo for scheduling checks
function isCairoActive(from?: string | null, to?: string | null): boolean {
  if (!from && !to) return true;
  const now = new Date();
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime()) && now < fromDate) return false;
  }
  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime()) && now > toDate) return false;
  }
  return true;
}

export async function GET(req: Request) {
  try {
    const row = await db.storeSettings.findUnique({ where: { key: 'announce_bar' } });
    let config: AnnounceBarConfig = DEFAULT_ANNOUNCE_CONFIG;

    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        config = {
          ...DEFAULT_ANNOUNCE_CONFIG,
          ...parsed,
          colors: { ...DEFAULT_ANNOUNCE_CONFIG.colors, ...(parsed.colors || {}) },
        };
      } catch {
        config = DEFAULT_ANNOUNCE_CONFIG;
      }
    }

    // Filter active & non-expired messages
    const activeMessages = (config.messages || [])
      .filter((m) => m && m.active && m.text && isCairoActive(m.from, m.to))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, 8);

    const payload = {
      ...config,
      messages: activeMessages,
      enabled: config.enabled && activeMessages.length > 0,
    };

    const payloadStr = JSON.stringify(payload);
    const etag = `W/"${crypto.createHash('md5').update(payloadStr).digest('hex')}"`;

    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
        },
      });
    }

    return new NextResponse(payloadStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ETag: etag,
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    console.error('Error fetching announcement bar config:', err);
    return NextResponse.json(DEFAULT_ANNOUNCE_CONFIG, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
}
