// U29-THEME-STUDIO — server-side theme CSS resolution.
// Read once per request in the store/admin layouts and injected as a
// <style> in the document head BEFORE first paint → the owner's theme is
// live on every device with zero flash of the old colors. DB failure →
// '' → factory look.
// U54-PERF-ROBUST — the theme_v2 row is now served from the settings TTL
// cache (single-flight, invalidated on admin theme saves) instead of a fresh
// DB round-trip on every render.
import { getSettingRow } from '@/lib/settings-cache';
import { resolveThemeConfig, activePreset, themePresetToCss } from '@/lib/theme-config';

export async function getThemeCss(): Promise<string> {
  try {
    const row = await getSettingRow('theme_v2');
    if (!row) return '';
    const config = resolveThemeConfig(JSON.parse(row.value));
    return themePresetToCss(activePreset(config));
  } catch {
    return '';
  }
}

export async function getThemeConfig(): Promise<unknown> {
  try {
    const row = await getSettingRow('theme_v2');
    if (!row) return null;
    return resolveThemeConfig(JSON.parse(row.value));
  } catch {
    return null;
  }
}
