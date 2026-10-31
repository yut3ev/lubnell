'use client';

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_ANNOUNCE_CONFIG, type AnnounceBarConfig, type AnnounceMessage } from '@/app/api/announce/route';

const ICONS: Record<string, string> = {
  flower: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5c-2.5-3.5-1-6.5 0-6.5s2.5 3 0 6.5zM12 14.5c-2.5 3.5-1 6.5 0 6.5s2.5-3 0-6.5zM9.5 12c-3.5-2.5-6.5-1-6.5 0s3 2.5 6.5 0zM14.5 12c3.5 2.5 6.5 1 6.5 0s-3-2.5-6.5 0z"/>',
  truck: '<path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  gift: '<rect x="4" y="10" width="16" height="10" rx="1"/><rect x="3" y="7" width="18" height="4" rx="1"/><path d="M12 7v13M12 7c-2-4-6-3-5-1s5 1 5 1zM12 7c2-4 6-3 5-1s-5 1-5 1z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
};

export const ANNOUNCE_THEMES = {
  rose: {
    bg: '#8a3a46',
    fg: '#ffffff',
    hi: '#f9e7b8',
    stem: '#a8cf96',
    rope: '#e9a9ae',
    flags: ['#e9a9ae', '#f9e7b8', '#e4d8ec', '#f7d9c8', '#ffffff'],
  },
  peach: {
    bg: '#fbe4d6',
    fg: '#5a2230',
    hi: '#8a3a46',
    stem: '#6f8f5e',
    rope: '#c9677a',
    flags: ['#e9a9ae', '#ffffff', '#f9e7b8', '#b9d3a8', '#e4d8ec'],
  },
  sage: {
    bg: '#d3e0c9',
    fg: '#34452c',
    hi: '#8a3a46',
    stem: '#5b7a4c',
    rope: '#6f8f5e',
    flags: ['#f7d9c8', '#e9a9ae', '#ffffff', '#f9e7b8', '#e4d8ec'],
  },
  lilac: {
    bg: '#6a4a7c',
    fg: '#ffffff',
    hi: '#f9e7b8',
    stem: '#b9d3a8',
    rope: '#e4d8ec',
    flags: ['#e4d8ec', '#e9a9ae', '#f9e7b8', '#d3e0c9', '#ffffff'],
  },
};

function isHex(c: unknown): boolean {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c);
}

function isColorDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, '$&$&') : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function flagSvg(color: string, k: number) {
  const motifs = [
    '<path d="M20 14c-4-6-1-10 0-10s4 4 0 10zM20 20c-4 6-1 10 0 10s4-4 0-10zM15 17c-6-4-10-1-10 0s4 4 10 0zM25 17c6 4 10 1 10 0s-4-4-10 0z" transform="translate(-5 -4) scale(.9)"/>',
    '<path d="M8 14h14M15 8v10M10 20l5 6 5-6"/>',
    '<circle cx="15" cy="14" r="3"/><path d="M15 11c-3-5-1-7 0-7s3 2 0 7zM15 17v8M15 21c-3 0-5-2-5-4 3 0 5 2 5 4z"/>',
    '<path d="M15 24V10M15 16c-4 0-6-3-6-6 4 0 6 3 6 6zM15 13c4 0 6-3 6-6-4 0-6 3-6 6z"/>',
  ];
  return `
    <svg viewBox="0 0 30 34" width="100%" height="100%" style="overflow:visible;display:block;">
      <path d="M1 0h28L15 30z" fill="${color}" stroke="#00000018"/>
      <g fill="none" stroke="#8a3a46" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        ${motifs[k % 4]}
      </g>
    </svg>
  `;
}

function growSvg(stemColor: string, k: number) {
  const blooms = [
    '<circle cx="17" cy="9" r="3" fill="#f9e7b8"/><path d="M17 6c-3-4-1-6 0-6s3 2 0 6zM17 12c-3 4-1 6 0 6s3-2 0-6zM14 9c-4-3-6-1-6 0s2 3 6 0zM20 9c4 3 6 1 6 0s-2-3-6 0z" fill="#e9a9ae"/>',
    '<path d="M12 12c0-6 2-9 5-9s5 3 5 9c0 3-10 3-10 0z" fill="#e9a9ae"/>',
    '<circle cx="17" cy="4" r="3" fill="#e4d8ec"/><circle cx="22" cy="9" r="3" fill="#e4d8ec"/><circle cx="17" cy="14" r="3" fill="#e4d8ec"/><circle cx="12" cy="9" r="3" fill="#e4d8ec"/><circle cx="17" cy="9" r="2.2" fill="#f9e7b8"/>',
  ];
  return `
    <svg viewBox="0 0 34 44" width="100%" height="100%" style="overflow:visible;display:block;" fill="none" stroke="${stemColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 44V14"/>
      <path d="M17 32c-5 0-8-3-8-7 5 0 8 3 8 7zM17 26c5 0 8-3 8-7-5 0-8 3-8 7z" fill="#b9d3a8"/>
      ${blooms[k % 3]}
    </svg>
  `;
}

const emptySubscribe = () => () => {};

export function AnnouncementBar({
  initialConfig,
  previewConfig,
  isMobilePreview,
}: {
  initialConfig?: AnnounceBarConfig;
  previewConfig?: AnnounceBarConfig;
  isMobilePreview?: boolean;
}) {
  const pathname = usePathname();
  const [config, setConfig] = useState<AnnounceBarConfig>(initialConfig || DEFAULT_ANNOUNCE_CONFIG);
  const activeConfig = previewConfig || config;
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<number | null>(null);

  // Check if dismissed previously
  useEffect(() => {
    if (previewConfig) return;
    try {
      const storageKey = 'lubnel_ann_dismissed';
      const ttl = activeConfig.dismissTtlHours ?? 0;
      if (ttl === 0) {
        if (sessionStorage.getItem(storageKey) === '1') {
          queueMicrotask(() => setDismissed(true));
        }
      } else {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const expiresAt = Number(stored);
          if (Date.now() < expiresAt) {
            queueMicrotask(() => setDismissed(true));
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      }
    } catch {}
  }, [activeConfig.dismissTtlHours, previewConfig]);

  // Fetch / Polling every 60s for real storefront
  useEffect(() => {
    if (previewConfig) return;
    let active = true;
    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/announce');
        if (res.ok && active) {
          const data = await res.json();
          if (data && active) setConfig(data);
        }
      } catch {}
    };

    fetchLatest();
    const interval = setInterval(() => {
      if (!document.hidden) fetchLatest();
    }, 60000);

    const onVisChange = () => {
      if (!document.hidden) fetchLatest();
    };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [previewConfig]);

  // Active messages list
  const messages: AnnounceMessage[] = (activeConfig.messages || []).filter((m) => m && m.active && m.text);

  // Auto rotation
  const nextMessage = useCallback(() => {
    if (messages.length <= 1) return;
    setActiveIdx((current) => {
      setPrevIdx(current);
      return (current + 1) % messages.length;
    });
  }, [messages.length]);

  const prevMessage = useCallback(() => {
    if (messages.length <= 1) return;
    setActiveIdx((current) => {
      setPrevIdx(current);
      return (current - 1 + messages.length) % messages.length;
    });
  }, [messages.length]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (paused || dismissed || messages.length <= 1 || (activeConfig.intervalMs ?? 5000) <= 0) return;

    timerRef.current = setTimeout(() => {
      nextMessage();
    }, activeConfig.intervalMs || 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIdx, paused, dismissed, messages.length, activeConfig.intervalMs, nextMessage]);

  // Handle dismiss
  const handleDismiss = () => {
    setDismissed(true);
    if (previewConfig) return;
    try {
      const storageKey = 'lubnel_ann_dismissed';
      const ttl = activeConfig.dismissTtlHours ?? 0;
      if (ttl === 0) {
        sessionStorage.setItem(storageKey, '1');
      } else {
        const expiresAt = Date.now() + ttl * 3600 * 1000;
        localStorage.setItem(storageKey, String(expiresAt));
      }
    } catch {}
  };

  // Check showOn routing
  const shouldShowOnRoute = useCallback(() => {
    if (previewConfig) return true;
    if (!activeConfig.enabled) return false;
    const paths = activeConfig.showOn || ['*'];
    if (paths.includes('*')) return true;
    if (paths.includes('/') && pathname === '/') return true;
    return paths.some((p) => {
      if (p.endsWith('/*')) return pathname.startsWith(p.slice(0, -2));
      return pathname === p;
    });
  }, [activeConfig.enabled, activeConfig.showOn, pathname, previewConfig]);

  if (!shouldShowOnRoute() || dismissed || messages.length === 0) {
    return null;
  }

  // Resolved Theme Colors
  const themeBase = ANNOUNCE_THEMES[activeConfig.theme] || ANNOUNCE_THEMES.rose;
  const oColors = activeConfig.colors || {};
  const bg = isHex(oColors.bg) ? oColors.bg! : themeBase.bg;
  let fg = isHex(oColors.fg) ? oColors.fg! : themeBase.fg;
  if (isHex(oColors.bg) && !isHex(oColors.fg)) {
    fg = isColorDark(bg) ? '#ffffff' : '#4a2230';
  }
  const hi = isHex(oColors.hi) ? oColors.hi! : themeBase.hi;
  const stem = isHex(oColors.stem) ? oColors.stem! : themeBase.stem;
  const rope = isHex(oColors.rope) ? oColors.rope! : themeBase.rope;
  const flags = (oColors.flags && oColors.flags.length >= 2 ? oColors.flags : themeBase.flags).filter(isHex);
  const transitionMs = Math.max(150, Math.min(2000, activeConfig.transitionMs || 700));
  const isFade = activeConfig.effect === 'fade';

  // Render text safely: text with {b}...{/b}
  const renderMessageContent = (msg: AnnounceMessage) => {
    const rawText = msg.text || '';
    const parts = rawText.split(/(\{b\}.*?\{\/b\})/g);
    const elements = parts.map((part, idx) => {
      if (/^\{b\}(.*?)\{\/b\}$/.test(part)) {
        const inner = part.replace(/^\{b\}|\{\/b\}$/g, '');
        return <b key={idx} style={{ color: hi, fontWeight: 800 }}>{inner}</b>;
      }
      return <span key={idx}>{part}</span>;
    });

    const iconSvg = ICONS[msg.icon] || ICONS.flower;
    const isLink = Boolean(msg.href && /^(https?:\/\/|\/|#)/.test(msg.href));

    const contentInner = (
      <>
        <svg
          viewBox="0 0 24 24"
          style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', stroke: hi, fill: 'none', strokeWidth: 1.8, flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
        <span className="truncate">{elements}</span>
        {isLink && (
          <svg
            className="ar"
            viewBox="0 0 24 24"
            style={{ width: '13px', height: '13px', minWidth: '13px', minHeight: '13px', stroke: fg, fill: 'none', strokeWidth: 2, opacity: 0.75, flexShrink: 0 }}
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        )}
      </>
    );

    if (isLink) {
      return (
        <a
          href={msg.href!}
          className="flex items-center justify-center gap-2 sm:gap-2.5 text-center text-[0.78rem] sm:text-[0.88rem] font-bold no-underline hover:underline"
          style={{ color: fg }}
        >
          {contentInner}
        </a>
      );
    }

    return (
      <div className="flex items-center justify-center gap-2 sm:gap-2.5 text-center text-[0.78rem] sm:text-[0.88rem] font-bold" style={{ color: fg }}>
        {contentInner}
      </div>
    );
  };

  const flagCount = isMobilePreview ? 5 : 9;
  const flowerPositions = [7, 12, 17, 23, 73, 79, 84, 90];

  return (
    <div
      role="region"
      aria-label="إعلانات المتجر"
      dir="rtl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="ann-container relative z-40 w-full overflow-visible transition-all duration-500 ease-out"
      style={{
        backgroundColor: bg,
        color: fg,
        height: '42px',
        marginBottom: '26px',
        fontFamily: 'var(--font-checkout-cairo, Cairo), system-ui, sans-serif',
      }}
    >
      {/* Decorative Bunting Flags & Side Flowers */}
      <div className="pointer-events-none absolute inset-0 overflow-visible">
        {/* Radial sheen overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 10% 130%, rgba(255,255,255,0.07) 0 30%, transparent 31%), radial-gradient(circle at 90% -30%, rgba(255,255,255,0.05) 0 28%, transparent 29%)',
          }}
        />

        {/* Bunting Flags */}
        {activeConfig.flags !== false && (
          <>
            <svg
              className="absolute inset-x-0 top-full h-[20px] w-full"
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              fill="none"
              stroke={rope}
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M3 0Q50 9 97 0" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="absolute inset-x-[3%] top-full flex justify-between pointer-events-none">
              {Array.from({ length: flagCount }).map((_, k) => (
                <div
                  key={k}
                  className={`fg-flag ${k % 2 === 1 ? 'hidden sm:block' : ''}`}
                  style={{
                    width: '30px',
                    height: '34px',
                    transformOrigin: '50% 0',
                    animation: 'ann-sw 4.2s ease-in-out infinite alternate',
                    animationDelay: `${k * -0.7}s`,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: flagSvg(flags[k % flags.length] || '#e9a9ae', k),
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Growing Side Flowers */}
        {activeConfig.flowers !== false && (
          <>
            {flowerPositions.map((pos, k) => (
              <div
                key={k}
                className={`flower-gr absolute bottom-[-2px] ${k % 2 === 1 ? 'hidden sm:block' : ''}`}
                style={{
                  insetInlineStart: `${pos}%`,
                  height: `${30 + (k % 3) * 6}px`,
                  width: '34px',
                  transformOrigin: '50% 100%',
                  animation: 'ann-gw 1.4s cubic-bezier(.34,1.56,.64,1) both, ann-sy 5s 1.6s ease-in-out infinite alternate',
                  animationDelay: `${k * 0.18}s, ${k * 0.18 + 1.6}s`,
                }}
                dangerouslySetInnerHTML={{ __html: growSvg(stem, k) }}
              />
            ))}
          </>
        )}
      </div>

      {/* Main Bar Contents: Prev Button, Messages Viewport, Dismiss Button */}
      <div
        className="relative z-10 mx-auto grid max-w-6xl grid-cols-[1fr_34px] sm:grid-cols-[38px_1fr_38px] items-center px-2"
        style={{ height: '42px' }}
      >
        {/* Previous/Next Switcher Button (desktop only) */}
        <div className="hidden sm:flex items-center justify-center">
          {messages.length > 1 && (
            <button
              type="button"
              onClick={prevMessage}
              aria-label="الإعلان السابق"
              className="grid h-8 w-8 place-items-center rounded-full text-current opacity-80 transition-all hover:bg-white/20 hover:opacity-100 active:scale-90"
            >
              <svg viewBox="0 0 24 24" style={{ width: '15px', height: '15px', stroke: 'currentColor', strokeWidth: 2.2, fill: 'none' }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* Messages Viewport */}
        <div
          className="relative overflow-hidden"
          style={{ height: '42px' }}
          aria-live="polite"
          onTouchStart={(e) => {
            touchStartRef.current = e.touches[0].clientX;
            setPaused(true);
          }}
          onTouchEnd={(e) => {
            if (touchStartRef.current != null) {
              const diff = e.changedTouches[0].clientX - touchStartRef.current;
              touchStartRef.current = null;
              setPaused(false);
              if (Math.abs(diff) > 40) {
                if (diff < 0) nextMessage();
                else prevMessage();
              }
            }
          }}
        >
          {messages.map((msg, i) => {
            const isActive = i === activeIdx;
            const isPrev = i === prevIdx;

            return (
              <div
                key={msg.id}
                aria-hidden={!isActive}
                className="absolute inset-0 flex items-center justify-center px-2 transition-all"
                style={{
                  transitionProperty: isFade ? 'opacity' : 'transform, opacity',
                  transitionDuration: `${transitionMs}ms`,
                  transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)',
                  opacity: isActive ? 1 : 0,
                  transform: isFade
                    ? 'none'
                    : isActive
                    ? 'translateY(0)'
                    : isPrev
                    ? 'translateY(-120%)'
                    : 'translateY(120%)',
                  pointerEvents: isActive ? 'auto' : 'none',
                }}
              >
                {renderMessageContent(msg)}
              </div>
            );
          })}
        </div>

        {/* Dismiss Button */}
        <div className="flex items-center justify-center">
          {activeConfig.dismissible && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="إغلاق شريط الإعلانات"
              className="grid h-8 w-8 place-items-center rounded-full text-current opacity-80 transition-all hover:bg-white/20 hover:opacity-100 active:scale-90"
            >
              <svg viewBox="0 0 24 24" style={{ width: '15px', height: '15px', stroke: 'currentColor', strokeWidth: 2.2, fill: 'none' }}>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress Line */}
      {messages.length > 1 && (activeConfig.intervalMs || 5000) > 0 && !paused && isClient && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden" aria-hidden="true">
          <div
            key={activeIdx}
            className="h-full origin-right"
            style={{
              backgroundColor: hi,
              opacity: 0.55,
              animation: `ann-pr ${activeConfig.intervalMs || 5000}ms linear forwards`,
            }}
          />
        </div>
      )}

      {/* CSS Keyframes */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes ann-sw {
            from { transform: rotate(-7deg); }
            to { transform: rotate(7deg); }
          }
          @keyframes ann-gw {
            from { transform: scaleY(0); }
            to { transform: scaleY(1); }
          }
          @keyframes ann-sy {
            from { transform: rotate(-4deg); }
            to { transform: rotate(4deg); }
          }
          @keyframes ann-pr {
            from { transform: scaleX(0); }
            to { transform: scaleX(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .ann-container * {
              animation-duration: 0.01s !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01s !important;
            }
          }
        `,
      }} />
    </div>
  );
}
