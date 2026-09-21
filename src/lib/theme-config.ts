// U29-THEME-STUDIO — Global Theme & Color Control.
// One source of truth: Theme Configuration (StoreSettings key "theme_v2")
// → CSS variables (emitted server-side in <head>, zero flash) → every
// component (Tailwind semantic utilities already read --background/--primary/
// --card/… so the whole storefront + admin re-themes without touching a
// single component file).
//
// Layered on top of the SUP-8 preset system (theme-presets.ts, key "theme"):
// when a v2 config exists it wins; when it doesn't, the old behavior is
// untouched. New tokens that have no shadcn slot (header/footer/button/link/
// icon/badge/shadow) are emitted as --color-* custom properties and consumed
// in globals.css / the header & footer components with faithful fallbacks,
// so an EMPTY theme renders byte-for-byte like today.

export type ColorValue = { hex: string; alpha: number }; // alpha 0–100

export type TokenKey =
  | 'background'      // الخلفية الرئيسية        → --background
  | 'backgroundAlt'   // الخلفيات الثانوية       → --muted
  | 'card'            // البطاقات                → --card
  | 'popover'         // المودالات / القوائم     → --popover
  | 'header'          // الهيدر                  → --color-header
  | 'footer'          // الفوتر                  → --color-footer
  | 'primary'         // الأساسي                 → --primary (+ --ring)
  | 'secondary'       // الثانوي                 → --secondary
  | 'accent'          // التمييز                 → --accent
  | 'text'            // النص الرئيسي            → --foreground
  | 'textMuted'       // النص الثانوي            → --muted-foreground
  | 'button'          // الأزرار                 → --color-button
  | 'buttonHover'     // Hover الأزرار           → --color-button-hover
  | 'link'            // الروابط                 → --color-link
  | 'icon'            // الأيقونات               → --color-icon
  | 'border'          // الحدود                  → --border (+ --input fallback)
  | 'badge'           // البادجات                → --color-badge
  | 'input'           // الحقول                  → --input
  | 'shadow';         // الظلال                  → --tw-shadow-color

export type TokenGroup = 'backgrounds' | 'brand' | 'typography' | 'components' | 'effects';

export const TOKEN_GROUPS: { key: TokenGroup; labelAr: string; icon: string }[] = [
  { key: 'backgrounds', labelAr: 'الخلفيات', icon: '🖼️' },
  { key: 'brand', labelAr: 'الهوية', icon: '🎨' },
  { key: 'typography', labelAr: 'النصوص', icon: '✍️' },
  { key: 'components', labelAr: 'المكونات', icon: '🧩' },
  { key: 'effects', labelAr: 'التأثيرات', icon: '✨' },
];

export const THEME_TOKENS: { key: TokenKey; group: TokenGroup; labelAr: string; hintAr?: string }[] = [
  { key: 'background', group: 'backgrounds', labelAr: 'الخلفية الرئيسية', hintAr: 'خلفية الصفحة بالكامل' },
  { key: 'backgroundAlt', group: 'backgrounds', labelAr: 'الخلفيات الثانوية', hintAr: 'الشرائح والمناطق الخفيفة' },
  { key: 'card', group: 'backgrounds', labelAr: 'البطاقات (Cards)' },
  { key: 'popover', group: 'backgrounds', labelAr: 'المودالات والقوائم' },
  { key: 'header', group: 'backgrounds', labelAr: 'خلفية الهيدر' },
  { key: 'footer', group: 'backgrounds', labelAr: 'خلفية الفوتر' },
  { key: 'primary', group: 'brand', labelAr: 'اللون الأساسي (Primary)', hintAr: 'الأزرار الرئيسية والهوية' },
  { key: 'secondary', group: 'brand', labelAr: 'اللون الثانوي (Secondary)' },
  { key: 'accent', group: 'brand', labelAr: 'لون التمييز (Accent)', hintAr: 'الميداليات والشارات المميزة' },
  { key: 'text', group: 'typography', labelAr: 'النص الرئيسي' },
  { key: 'textMuted', group: 'typography', labelAr: 'النص الثانوي' },
  { key: 'button', group: 'components', labelAr: 'لون الأزرار', hintAr: 'يفوق لون الهوية للأزرار الصلبة' },
  { key: 'buttonHover', group: 'components', labelAr: 'Hover الأزرار' },
  { key: 'link', group: 'components', labelAr: 'لون الروابط' },
  { key: 'icon', group: 'components', labelAr: 'لون الأيقونات', hintAr: 'الأيقونات المستقلة خارج الأزرار' },
  { key: 'border', group: 'components', labelAr: 'الحدود (Borders)' },
  { key: 'badge', group: 'components', labelAr: 'البادجات (Badges)' },
  { key: 'input', group: 'components', labelAr: 'الحقول (Inputs)' },
  { key: 'shadow', group: 'effects', labelAr: 'لون الظلال' },
];

// ---------------- Background (advanced) ----------------

export type BackgroundMode = 'solid' | 'gradient' | 'transparent' | 'image' | 'image-overlay';

export type ThemeBackground = {
  mode: BackgroundMode;
  /** solid mode color */
  color: ColorValue | null;
  /** gradient mode */
  gradient: { from: ColorValue; to: ColorValue; angle: number; type: 'linear' | 'radial' } | null;
  /** image / image-overlay mode url */
  image: string;
  /** image-overlay tint */
  overlayColor: string;
  overlayAlpha: number; // 0–100
};

// ---------------- Presets & config ----------------

export type ThemePresetV2 = {
  id: string;
  name: string;
  builtIn?: boolean;
  /** unset token = inherit the factory look for that token */
  tokens: Partial<Record<TokenKey, ColorValue>>;
  background: ThemeBackground;
};

export type ThemeConfigV2 = {
  version: 2;
  /** '' = factory default look */
  activeId: string;
  presets: ThemePresetV2[];
};

// ---------------- Color helpers ----------------

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHex(raw: string): string | null {
  let h = (raw || '').trim();
  if (!h) return null;
  if (h[0] !== '#') h = `#${h}`;
  if (!HEX_RE.test(h)) return null;
  if (h.length === 4) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return h.toLowerCase();
}

/** #rrggbb + alpha 0–100 → #rrggbbaa (alpha 100 → #rrggbb). */
export function colorToCss(c: ColorValue | null | undefined): string | null {
  if (!c) return null;
  const hex = normalizeHex(c.hex);
  if (!hex) return null;
  const a = Math.max(0, Math.min(100, Math.round(c.alpha)));
  if (a <= 0) return 'transparent';
  if (a >= 100) return hex;
  const aa = Math.round((a / 100) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${aa}`;
}

/** WCAG relative luminance (0–1). */
export function luminance(hex: string): number {
  const h = normalizeHex(hex);
  if (!h) return 1;
  const ch = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  if (lb === 0 && hi === 0) return 1;
  return (hi + 0.05) / (lo + 0.05);
}

/** Auto text color over a surface — warm white / dark cocoa (never pure b/w). */
export function autoForeground(hex: string | null | undefined): string {
  if (!hex) return '#fdf8f3';
  const l = luminance(hex);
  return l > 0.55 ? '#33261f' : '#fdf8f3';
}

export type ContrastWarning = { labelAr: string; ratio: number; level: 'low' | 'very-low' };

/** Legibility audit over the effective pairs (warning-only, never blocking). */
export function contrastWarnings(tokens: Partial<Record<TokenKey, ColorValue>>): ContrastWarning[] {
  const bgHex = tokens.background?.hex ?? null;
  const cardHex = tokens.card?.hex ?? bgHex;
  const out: ContrastWarning[] = [];
  const check = (fgHex: string | null, bgHex2: string | null, labelAr: string, min: number) => {
    if (!fgHex || !bgHex2) return;
    const bg = normalizeHex(bgHex2);
    const fg = normalizeHex(fgHex);
    if (!fg || !bg) return;
    const ratio = contrastRatio(fg, bg);
    if (ratio < min) {
      out.push({ labelAr, ratio: Math.round(ratio * 10) / 10, level: ratio < min / 1.6 ? 'very-low' : 'low' });
    }
  };
  const textHex = tokens.text?.hex ?? null;
  const mutedHex = tokens.textMuted?.hex ?? null;
  const linkHex = tokens.link?.hex ?? tokens.primary?.hex ?? null;
  check(textHex, bgHex, 'النص الرئيسي على الخلفية', 4.5);
  check(textHex, cardHex, 'النص الرئيسي على البطاقات', 4.5);
  check(mutedHex, bgHex, 'النص الثانوي على الخلفية', 3);
  check(linkHex, bgHex, 'الروابط على الخلفية', 3);
  if (tokens.button?.hex && tokens.buttonHover?.hex) {
    const b = normalizeHex(tokens.button.hex)!;
    const h = normalizeHex(tokens.buttonHover.hex)!;
    const r = contrastRatio(b, h);
    if (r < 1.15) out.push({ labelAr: 'Hover الأزرار قريب جدًا من لون الزر', ratio: Math.round(r * 100) / 100, level: 'low' });
  }
  return out;
}

// ---------------- Built-in presets ----------------

function bg(mode: BackgroundMode, extra: Partial<ThemeBackground> = {}): ThemeBackground {
  return {
    mode,
    color: mode === 'solid' ? { hex: '#faf6ef', alpha: 100 } : null,
    gradient: null,
    image: '',
    overlayColor: '#0b0b0d',
    overlayAlpha: 45,
    ...extra,
  };
}

export const BUILTIN_PRESETS: ThemePresetV2[] = [
  {
    id: 'default',
    name: 'لوبنيل الافتراضي',
    builtIn: true,
    tokens: {}, // factory look, zero overrides
    background: bg('solid'),
  },
  {
    id: 'dark-luxury',
    name: 'Dark Luxury',
    builtIn: true,
    tokens: {
      background: { hex: '#151113', alpha: 100 },
      backgroundAlt: { hex: '#1f181b', alpha: 100 },
      card: { hex: '#231b1e', alpha: 100 },
      popover: { hex: '#271e21', alpha: 100 },
      header: { hex: '#171114', alpha: 92 },
      footer: { hex: '#100c0e', alpha: 100 },
      primary: { hex: '#c9a24b', alpha: 100 },
      secondary: { hex: '#2b2225', alpha: 100 },
      accent: { hex: '#3a2d24', alpha: 100 },
      text: { hex: '#f4ede4', alpha: 100 },
      textMuted: { hex: '#b7a99c', alpha: 100 },
      button: { hex: '#c9a24b', alpha: 100 },
      buttonHover: { hex: '#b58e3e', alpha: 100 },
      link: { hex: '#e2c078', alpha: 100 },
      border: { hex: '#ffffff', alpha: 12 },
      badge: { hex: '#c9a24b', alpha: 100 },
      input: { hex: '#2b2225', alpha: 100 },
      shadow: { hex: '#000000', alpha: 55 },
    },
    background: bg('gradient', {
      gradient: { from: { hex: '#151113', alpha: 100 }, to: { hex: '#241a14', alpha: 100 }, angle: 160, type: 'linear' },
    }),
  },
  {
    id: 'minimal',
    name: 'Minimal',
    builtIn: true,
    tokens: {
      background: { hex: '#ffffff', alpha: 100 },
      backgroundAlt: { hex: '#f6f6f6', alpha: 100 },
      card: { hex: '#ffffff', alpha: 100 },
      popover: { hex: '#ffffff', alpha: 100 },
      header: { hex: '#ffffff', alpha: 92 },
      footer: { hex: '#fafafa', alpha: 100 },
      primary: { hex: '#161616', alpha: 100 },
      secondary: { hex: '#f1f1f1', alpha: 100 },
      accent: { hex: '#f1f1f1', alpha: 100 },
      text: { hex: '#141414', alpha: 100 },
      textMuted: { hex: '#6d6d6d', alpha: 100 },
      button: { hex: '#161616', alpha: 100 },
      buttonHover: { hex: '#000000', alpha: 100 },
      link: { hex: '#161616', alpha: 100 },
      border: { hex: '#e6e6e6', alpha: 100 },
      badge: { hex: '#161616', alpha: 100 },
      input: { hex: '#ffffff', alpha: 100 },
      shadow: { hex: '#000000', alpha: 14 },
    },
    background: bg('solid', { color: { hex: '#ffffff', alpha: 100 } }),
  },
  {
    id: 'cream',
    name: 'Cream',
    builtIn: true,
    tokens: {
      background: { hex: '#faf3e7', alpha: 100 },
      backgroundAlt: { hex: '#f3e7d2', alpha: 100 },
      card: { hex: '#fffdf7', alpha: 100 },
      popover: { hex: '#fffdf7', alpha: 100 },
      header: { hex: '#fbf5ea', alpha: 92 },
      footer: { hex: '#f1e5cf', alpha: 100 },
      primary: { hex: '#9c6b3f', alpha: 100 },
      secondary: { hex: '#f0e2c8', alpha: 100 },
      accent: { hex: '#eed9a9', alpha: 100 },
      text: { hex: '#463526', alpha: 100 },
      textMuted: { hex: '#8b755a', alpha: 100 },
      button: { hex: '#9c6b3f', alpha: 100 },
      buttonHover: { hex: '#845733', alpha: 100 },
      link: { hex: '#8a5a2e', alpha: 100 },
      border: { hex: '#e5d3b3', alpha: 100 },
      badge: { hex: '#9c6b3f', alpha: 100 },
      input: { hex: '#fffdf7', alpha: 100 },
      shadow: { hex: '#5c4326', alpha: 18 },
    },
    background: bg('solid', { color: { hex: '#faf3e7', alpha: 100 } }),
  },
  {
    id: 'midnight',
    name: 'Midnight',
    builtIn: true,
    tokens: {
      background: { hex: '#0b0b0d', alpha: 100 },
      backgroundAlt: { hex: '#17121f', alpha: 100 },
      card: { hex: '#141019', alpha: 100 },
      popover: { hex: '#181320', alpha: 100 },
      header: { hex: '#0e0c12', alpha: 92 },
      footer: { hex: '#08070a', alpha: 100 },
      primary: { hex: '#a78bfa', alpha: 100 },
      secondary: { hex: '#221b30', alpha: 100 },
      accent: { hex: '#372a4d', alpha: 100 },
      text: { hex: '#ece8f6', alpha: 100 },
      textMuted: { hex: '#a79fc0', alpha: 100 },
      button: { hex: '#a78bfa', alpha: 100 },
      buttonHover: { hex: '#8f6fe8', alpha: 100 },
      link: { hex: '#c4b5fd', alpha: 100 },
      border: { hex: '#ffffff', alpha: 12 },
      badge: { hex: '#a78bfa', alpha: 100 },
      input: { hex: '#221b30', alpha: 100 },
      shadow: { hex: '#000000', alpha: 60 },
    },
    background: bg('gradient', {
      // the owner's reference: #0B0B0D → #17121F
      gradient: { from: { hex: '#0b0b0d', alpha: 100 }, to: { hex: '#17121f', alpha: 100 }, angle: 180, type: 'linear' },
    }),
  },
];

// ---------------- Resolution & CSS emission ----------------

export function emptyConfig(): ThemeConfigV2 {
  return { version: 2, activeId: '', presets: [] };
}

/** Clamp/repair an untrusted stored config — never throws. */
export function resolveThemeConfig(raw: unknown): ThemeConfigV2 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 2) return null;
  const presets: ThemePresetV2[] = Array.isArray(o.presets)
    ? (o.presets as Record<string, unknown>[]).slice(0, 40).map((p, i) => {
        const tokens: Partial<Record<TokenKey, ColorValue>> = {};
        const rawTokens = (p.tokens ?? {}) as Record<string, unknown>;
        for (const t of THEME_TOKENS) {
          const v = rawTokens[t.key] as Record<string, unknown> | undefined;
          if (!v) continue;
          const hex = normalizeHex(String(v.hex ?? ''));
          if (!hex) continue;
          const alpha = Math.max(0, Math.min(100, Math.round(Number(v.alpha ?? 100)) || 0));
          tokens[t.key] = { hex, alpha };
        }
        const rb = (p.background ?? {}) as Record<string, unknown>;
        const mode = ['solid', 'gradient', 'transparent', 'image', 'image-overlay'].includes(String(rb.mode))
          ? (String(rb.mode) as BackgroundMode)
          : 'solid';
        const rg = (rb.gradient ?? {}) as Record<string, unknown>;
        const gradFrom = normalizeHex(String(rg.from ? (rg.from as Record<string, unknown>).hex : '')) ?? '#faf6ef';
        const gradTo = normalizeHex(String(rg.to ? (rg.to as Record<string, unknown>).hex : '')) ?? '#17121f';
        return {
          id: String(p.id ?? `p${i}`).slice(0, 40),
          name: String(p.name ?? 'ثيم').slice(0, 40),
          builtIn: !!p.builtIn,
          tokens,
          background: {
            mode,
            color: rb.color ? { hex: normalizeHex(String((rb.color as Record<string, unknown>).hex ?? '')) ?? '#faf6ef', alpha: Math.max(0, Math.min(100, Math.round(Number((rb.color as Record<string, unknown>).alpha ?? 100)) || 100)) } : null,
            gradient: rg
              ? {
                  from: { hex: gradFrom, alpha: Math.max(0, Math.min(100, Math.round(Number(rg.from ? (rg.from as Record<string, unknown>).alpha : 100)) || 100)) },
                  to: { hex: gradTo, alpha: Math.max(0, Math.min(100, Math.round(Number(rg.to ? (rg.to as Record<string, unknown>).alpha : 100)) || 100)) },
                  angle: Math.max(0, Math.min(360, Math.round(Number(rg.angle ?? 180)) || 180)),
                  type: rg.type === 'radial' ? 'radial' : 'linear',
                }
              : null,
            image: typeof rb.image === 'string' ? rb.image.slice(0, 500) : '',
            overlayColor: normalizeHex(String(rb.overlayColor ?? '#0b0b0d')) ?? '#0b0b0d',
            overlayAlpha: Math.max(0, Math.min(100, Math.round(Number(rb.overlayAlpha ?? 45)) || 45)),
          },
        };
      })
    : [];
  return { version: 2, activeId: typeof o.activeId === 'string' ? o.activeId.slice(0, 40) : '', presets };
}

/** The preset that should render (activeId → presets → built-ins → null). */
export function activePreset(config: ThemeConfigV2 | null): ThemePresetV2 | null {
  if (!config || !config.activeId) return null;
  return config.presets.find((p) => p.id === config.activeId) ?? null;
}

/** background spec → full CSS `background-image` value ('' = none). */
export function backgroundImageCss(b: ThemeBackground): string {
  if (b.mode === 'gradient' && b.gradient) {
    const from = colorToCss(b.gradient.from) ?? '#faf6ef';
    const to = colorToCss(b.gradient.to) ?? '#17121f';
    return b.gradient.type === 'radial'
      ? `radial-gradient(circle at 50% 30%, ${from}, ${to})`
      : `linear-gradient(${b.gradient.angle}deg, ${from}, ${to})`;
  }
  if (b.mode === 'image' && b.image) {
    return `url("${b.image.replace(/"/g, '%22')}")`;
  }
  if (b.mode === 'image-overlay' && b.image) {
    const ov = normalizeHex(b.overlayColor) ?? '#0b0b0d';
    const a = Math.max(0, Math.min(100, Math.round(b.overlayAlpha)));
    const aa = Math.round((a / 100) * 255).toString(16).padStart(2, '0');
    return `linear-gradient(${ov}${aa}, ${ov}${aa}), url("${b.image.replace(/"/g, '%22')}")`;
  }
  return '';
}

/**
 * Emit the complete CSS for an active preset: shadcn token overrides +
 * the extended --color-* custom properties. '' when the preset defines
 * nothing (factory look → no style tag at all).
 */
export function themePresetToCss(preset: ThemePresetV2 | null): string {
  if (!preset) return '';
  const t = preset.tokens;
  const c = (k: TokenKey): string | null => colorToCss(t[k]);
  const lines: string[] = [];
  const put = (prop: string, val: string | null | undefined) => {
    if (val) lines.push(`  ${prop}: ${val};`);
  };

  // --- shadcn core tokens ---
  put('--background', c('background'));
  put('--muted', c('backgroundAlt'));
  put('--card', c('card'));
  put('--popover', c('popover'));
  put('--secondary', c('secondary'));
  put('--accent', c('accent'));
  put('--foreground', c('text'));
  put('--muted-foreground', c('textMuted'));
  put('--border', c('border'));
  put('--input', c('input') ?? c('border'));
  if (c('primary')) {
    put('--primary', c('primary'));
    put('--primary-foreground', autoForeground(t.primary?.hex));
    put('--ring', c('primary'));
    put('--sidebar-primary', c('primary'));
    put('--sidebar-ring', c('primary'));
  }
  if (c('secondary')) {
    put('--secondary-foreground', autoForeground(t.secondary?.hex));
    put('--sidebar-accent', c('secondary'));
  }
  if (c('accent')) put('--accent-foreground', autoForeground(t.accent?.hex));
  if (c('card')) put('--card-foreground', t.text ? colorToCss(t.text) : autoForeground(t.card?.hex));
  if (c('popover')) put('--popover-foreground', t.text ? colorToCss(t.text) : autoForeground(t.popover?.hex));
  if (c('text')) {
    put('--card-foreground', c('text'));
    put('--popover-foreground', c('text'));
    put('--sidebar-foreground', c('text'));
  }
  put('--sidebar', c('card') ?? c('background'));
  put('--sidebar-border', c('border'));

  // --- extended tokens (consumed by globals.css + header/footer) ---
  put('--color-header', c('header'));
  put('--color-footer', c('footer'));
  put('--color-button', c('button') ?? c('primary'));
  put('--color-button-hover', c('buttonHover'));
  put('--color-link', c('link'));
  put('--color-icon', c('icon'));
  put('--color-badge', c('badge'));
  if (c('badge')) put('--color-badge-foreground', autoForeground(t.badge?.hex));
  put('--tw-shadow-color', c('shadow'));

  // --- advanced page background ---
  const bgImage = backgroundImageCss(preset.background);
  if (preset.background.mode === 'transparent') {
    lines.push('  --background: transparent;');
  } else if (preset.background.mode === 'solid' && preset.background.color) {
    put('--background', colorToCss(preset.background.color));
  }
  if (bgImage) {
    lines.push(`  --page-bg-image: ${bgImage};`);
  }

  if (!lines.length) return '';
  return `:root{\n${lines.join('\n')}\n}`;
}

/** Live-preview style object (same values as themePresetToCss, for React). */
export function themePresetToVars(preset: ThemePresetV2 | null): Record<string, string> {
  if (!preset) return {};
  const css = themePresetToCss(preset);
  if (!css) return {};
  const vars: Record<string, string> = {};
  // parse back the simple `--x: y;` lines (all values are flat tokens)
  for (const m of css.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    const val = m[2].trim();
    if (val.startsWith('url(') || val.startsWith('linear') || val.startsWith('radial')) {
      vars['--page-bg-image'] = val;
    } else {
      vars[`--${m[1]}`] = val;
    }
  }
  return vars;
}
