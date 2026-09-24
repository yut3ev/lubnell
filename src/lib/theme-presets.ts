// SUP-8 — ready-made color themes for the storefront. Stored in
// StoreSettings key "theme" as { preset: string, values?: Partial<ThemePalette> }.
// Applied server-side in (store)/layout.tsx by overriding the Tailwind CSS
// variables on a wrapper element (hex values are valid CSS custom props, so
// every bg-primary / text-primary / border-border utility re-themes instantly).

export type ThemePalette = {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
};

export type ThemePreset = {
  id: string;
  label: string;
  swatch: [string, string, string]; // preview dots: primary, secondary, accent
} & ThemePalette;

// No blues/indigos — warm, elegant, LUBNÉL-appropriate palettes only.
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'rose',
    label: 'الروز الكلاسيكي',
    primary: '#9d4e45',
    primaryForeground: '#fdf7f4',
    secondary: '#f2e4e1',
    secondaryForeground: '#5c3a35',
    accent: '#eed9c6',
    accentForeground: '#54402c',
    ring: '#b26058',
    chart1: '#9d4e45',
    chart2: '#c98a76',
    chart3: '#e3c8a8',
    swatch: ['#9d4e45', '#f2e4e1', '#eed9c6'],
  },
  {
    id: 'emerald',
    label: 'زمردي فاخر',
    primary: '#2f6b4f',
    primaryForeground: '#f4faf7',
    secondary: '#e2efe8',
    secondaryForeground: '#2c4a3c',
    accent: '#dbeadb',
    accentForeground: '#33502f',
    ring: '#3e8266',
    chart1: '#2f6b4f',
    chart2: '#6fa388',
    chart3: '#c2dcc9',
    swatch: ['#2f6b4f', '#e2efe8', '#dbeadb'],
  },
  {
    id: 'wine',
    label: 'نبيذي ملكي',
    primary: '#7a2e3b',
    primaryForeground: '#fdf4f5',
    secondary: '#f1e2e5',
    secondaryForeground: '#4e2c33',
    accent: '#efd9de',
    accentForeground: '#573239',
    ring: '#94404e',
    chart1: '#7a2e3b',
    chart2: '#b06a76',
    chart3: '#dcb8c0',
    swatch: ['#7a2e3b', '#f1e2e5', '#efd9de'],
  },
  {
    id: 'gold',
    label: 'ذهبي فاخر',
    primary: '#a0762e',
    primaryForeground: '#fffaef',
    secondary: '#f4ebd9',
    secondaryForeground: '#57431f',
    accent: '#efe3c8',
    accentForeground: '#5a4a28',
    ring: '#c09545',
    chart1: '#a0762e',
    chart2: '#cfa963',
    chart3: '#ecd9ae',
    swatch: ['#a0762e', '#f4ebd9', '#efe3c8'],
  },
  {
    id: 'violet',
    label: 'بنفسجي راقٍ',
    primary: '#6d4a8c',
    primaryForeground: '#fbf7fd',
    secondary: '#ede7f3',
    secondaryForeground: '#43355a',
    accent: '#e6dbf0',
    accentForeground: '#4b3a63',
    ring: '#86619f',
    chart1: '#6d4a8c',
    chart2: '#a484bd',
    chart3: '#d4c2e4',
    swatch: ['#6d4a8c', '#ede7f3', '#e6dbf0'],
  },
  {
    id: 'terracotta',
    label: 'تراكوتا دافئ',
    primary: '#b45a3c',
    primaryForeground: '#fdf6f2',
    secondary: '#f6e7de',
    secondaryForeground: '#5e3a2b',
    accent: '#f3dccc',
    accentForeground: '#5c4232',
    ring: '#c76f50',
    chart1: '#b45a3c',
    chart2: '#d18b6d',
    chart3: '#ecc3a6',
    swatch: ['#b45a3c', '#f6e7de', '#f3dccc'],
  },
  {
    id: 'teal',
    label: 'تيل منعش',
    primary: '#2e6e68',
    primaryForeground: '#f2faf9',
    secondary: '#e0efed',
    secondaryForeground: '#2b4a47',
    accent: '#d9ebe4',
    accentForeground: '#2f5047',
    ring: '#3f8a83',
    chart1: '#2e6e68',
    chart2: '#67a39b',
    chart3: '#bcdcd2',
    swatch: ['#2e6e68', '#e0efed', '#d9ebe4'],
  },
  {
    id: 'charcoal',
    label: 'فحمي أنيق',
    primary: '#3a3532',
    primaryForeground: '#faf7f4',
    secondary: '#ece9e6',
    secondaryForeground: '#3d3835',
    accent: '#e5e0db',
    accentForeground: '#443f3b',
    ring: '#5c5551',
    chart1: '#3a3532',
    chart2: '#847c76',
    chart3: '#c9c1ba',
    swatch: ['#3a3532', '#ece9e6', '#e5e0db'],
  },
];

export type ThemeSelection = { preset: string; values?: Partial<ThemePalette> };

export function findPreset(id: string | undefined | null): ThemePreset | null {
  return THEME_PRESETS.find((p) => p.id === id) ?? null;
}

/** Resolve a stored theme selection into a concrete palette (or null = site default). */
export function resolveTheme(stored: unknown): ThemePalette | null {
  if (!stored || typeof stored !== 'object') return null;
  const sel = stored as ThemeSelection;
  const preset = findPreset(sel.preset);
  const base: ThemePalette | null = preset
    ? {
        primary: preset.primary,
        primaryForeground: preset.primaryForeground,
        secondary: preset.secondary,
        secondaryForeground: preset.secondaryForeground,
        accent: preset.accent,
        accentForeground: preset.accentForeground,
        ring: preset.ring,
        chart1: preset.chart1,
        chart2: preset.chart2,
        chart3: preset.chart3,
      }
    : sel.preset === 'custom' && sel.values?.primary
      ? {
          primary: sel.values.primary,
          primaryForeground: sel.values.primaryForeground || '#fdf9f5',
          secondary: sel.values.secondary || '#f2e9e4',
          secondaryForeground: sel.values.secondaryForeground || '#4a3f3a',
          accent: sel.values.accent || sel.values.primary,
          accentForeground: sel.values.accentForeground || '#fdf9f5',
          ring: sel.values.ring || sel.values.primary,
          chart1: sel.values.primary,
          chart2: sel.values.chart2 || sel.values.primary,
          chart3: sel.values.chart3 || sel.values.accent || sel.values.primary,
        }
      : null;
  if (!base) return null;
  return base;
}

/** CSS custom-property overrides for a palette (empty object = site default). */
export function themeStyleVars(palette: ThemePalette | null): Record<string, string> {
  if (!palette) return {};
  return {
    '--primary': palette.primary,
    '--primary-foreground': palette.primaryForeground,
    '--secondary': palette.secondary,
    '--secondary-foreground': palette.secondaryForeground,
    '--accent': palette.accent,
    '--accent-foreground': palette.accentForeground,
    '--ring': palette.ring,
    '--chart-1': palette.chart1,
    '--chart-2': palette.chart2,
    '--chart-3': palette.chart3,
    '--sidebar-primary': palette.primary,
    '--sidebar-ring': palette.ring,
  };
}
