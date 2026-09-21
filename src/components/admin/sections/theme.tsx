'use client';

// U29-THEME-STUDIO — Global Theme & Color Control («🎨 هوية الموقع»).
// Replaces the SUP-8 preset picker with the full system the owner asked for:
//  • 19 color tokens in 5 groups, each = Color Picker + Hex + Opacity slider
//  • advanced background: Solid / Gradient (linear+radial, angle) /
//    Transparent / Image / Image + Overlay
//  • presets CRUD (built-ins + custom: apply / edit / duplicate / rename /
//    delete) stored in the DB (StoreSettings "theme_v2") — applied site-wide
//    server-side, no flash, works from any device
//  • live preview mock + LIVE application to the whole admin panel while
//    editing (inline CSS vars on <html>, cleaned up on unmount)
//  • WCAG contrast warnings (warning-only) + Reset-all (confirm) +
//    per-token reset
// Architecture: Theme Configuration → CSS Variables → all components.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { apiJson } from '../helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  BUILTIN_PRESETS,
  THEME_TOKENS,
  TOKEN_GROUPS,
  colorToCss,
  contrastWarnings,
  emptyConfig,
  normalizeHex,
  themePresetToVars,
  type ColorValue,
  type ThemeBackground,
  type ThemeConfigV2,
  type ThemePresetV2,
  type TokenKey,
} from '@/lib/theme-config';

const newId = () => `c-${Date.now().toString(36)}`;

const DEFAULT_BG: ThemeBackground = {
  mode: 'solid',
  color: { hex: '#faf6ef', alpha: 100 },
  gradient: { from: { hex: '#0b0b0d', alpha: 100 }, to: { hex: '#17121f', alpha: 100 }, angle: 180, type: 'linear' },
  image: '',
  overlayColor: '#0b0b0d',
  overlayAlpha: 45,
};

function clonePreset(p: ThemePresetV2): ThemePresetV2 {
  return {
    ...p,
    tokens: Object.fromEntries(Object.entries(p.tokens).map(([k, v]) => [k, { ...(v as ColorValue) }])),
    background: {
      ...p.background,
      color: p.background.color ? { ...p.background.color } : null,
      gradient: p.background.gradient
        ? { ...p.background.gradient, from: { ...p.background.gradient.from }, to: { ...p.background.gradient.to } }
        : null,
    },
  };
}

/** LIVE apply — inline vars on <html> re-theme the whole panel instantly.
    Returns the applied keys so stale vars can be removed on the next run. */
function applyLive(preset: ThemePresetV2 | null, prevKeys: string[]): string[] {
  const root = document.documentElement;
  for (const k of prevKeys) root.style.removeProperty(k);
  const vars = themePresetToVars(preset);
  const keys: string[] = [];
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
    keys.push(k);
  }
  return keys;
}

export default function ThemeSection() {
  const [config, setConfig] = useState<ThemeConfigV2>(emptyConfig());
  const [draft, setDraft] = useState<ThemePresetV2 | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const appliedKeysRef = useRef<string[]>([]);
  const { toast } = useToast();

  // ---------- load ----------
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const { ok, data } = await apiJson<{ ok: boolean; config: ThemeConfigV2 }>('/api/admin/theme');
      if (!alive) return;
      const cfg = ok && data?.ok ? data.config : emptyConfig();
      setConfig(cfg);
      const active =
        (cfg.activeId && (cfg.presets.find((p) => p.id === cfg.activeId) || BUILTIN_PRESETS.find((p) => p.id === cfg.activeId))) ||
        null;
      setDraft(active ? clonePreset(active) : null);
      setLoaded(true);
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  // ---------- live application ----------
  useEffect(() => {
    appliedKeysRef.current = applyLive(draft, appliedKeysRef.current);
  }, [draft]);
  useEffect(() => {
    // unmount → drop inline vars, the injected stylesheet takes over again
    const keys = appliedKeysRef.current;
    return () => {
      const root = document.documentElement;
      for (const k of keys) root.style.removeProperty(k);
    };
  }, []);

  // ---------- mutations ----------
  const setToken = useCallback((key: TokenKey, value: ColorValue | null) => {
    setDraft((d) => {
      if (!d) return d;
      const tokens = { ...d.tokens };
      if (value) tokens[key] = value;
      else delete tokens[key];
      return { ...d, tokens };
    });
    setDirty(true);
  }, []);

  const setBackground = useCallback((patch: Partial<ThemeBackground>) => {
    setDraft((d) => (d ? { ...d, background: { ...d.background, ...patch } } : d));
    setDirty(true);
  }, []);

  const selectPreset = (p: ThemePresetV2) => {
    setDraft(clonePreset(p));
    setDirty(true);
  };

  function upsertDraftInto(cfg: ThemeConfigV2, d: ThemePresetV2): ThemeConfigV2 {
    const idx = cfg.presets.findIndex((p) => p.id === d.id);
    const presets = [...cfg.presets];
    if (idx >= 0) presets[idx] = clonePreset(d);
    else presets.push(clonePreset(d));
    return { ...cfg, activeId: d.id, presets };
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const next = upsertDraftInto(config, draft);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>('/api/admin/theme', {
      method: 'PUT',
      body: JSON.stringify({ config: next }),
    });
    setSaving(false);
    if (ok && data?.ok) {
      setConfig(next);
      setDirty(false);
      toast({ title: 'تم تطبيق الهوية على الموقع بالكامل ✓' });
      // the server-rendered <style> in <head> is now stale — reload so the
      // freshly-injected CSS owns the panel again (inline live-vars are wiped)
      setTimeout(() => window.location.reload(), 600);
    } else {
      toast({ title: data?.error || 'تعذر الحفظ', variant: 'destructive' });
    }
  }

  async function resetAll() {
    setSaving(true);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>('/api/admin/theme', {
      method: 'PUT',
      body: JSON.stringify({ reset: true }),
    });
    setSaving(false);
    if (ok && data?.ok) {
      setConfig(emptyConfig());
      setDraft(null);
      setDirty(false);
      toast({ title: 'تمت إعادة الموقع إلى الثيم الافتراضي' });
      setTimeout(() => window.location.reload(), 600);
    } else {
      toast({ title: data?.error || 'تعذر إعادة التعيين', variant: 'destructive' });
    }
  }

  function createTheme() {
    const name = newName.trim() || 'ثيم مخصص';
    const base = draft ?? null;
    const p: ThemePresetV2 = base
      ? { ...clonePreset(base), id: newId(), name, builtIn: false }
      : { id: newId(), name, builtIn: false, tokens: {}, background: { ...DEFAULT_BG } };
    setConfig((c) => ({ ...c, presets: [...c.presets, p] }));
    setDraft(clonePreset(p));
    setDirty(true);
    setNewName('');
    setCreating(false);
  }

  function duplicate(id: string) {
    const src = allPresets.find((p) => p.id === id);
    if (!src) return;
    const p: ThemePresetV2 = { ...clonePreset(src), id: newId(), name: `${src.name} (نسخة)`, builtIn: false };
    setConfig((c) => ({ ...c, presets: [...c.presets, p] }));
    setDraft(clonePreset(p));
    setDirty(true);
    toast({ title: `تم إنشاء «${p.name}» — عدّلي الألوان ثم احفظي` });
  }

  function removeTheme(id: string) {
    setConfig((c) => ({
      ...c,
      presets: c.presets.filter((p) => p.id !== id),
      activeId: c.activeId === id ? '' : c.activeId,
    }));
    if (draft?.id === id) setDraft(null);
    setDirty(true);
  }

  function commitRename() {
    if (renamingId == null) return;
    const name = renameVal.trim();
    if (name) {
      setConfig((c) => {
        // custom preset → rename in place; built-in → materialize it into
        // the saved list so the new name (and future edits) persist
        if (c.presets.some((p) => p.id === renamingId)) {
          return { ...c, presets: c.presets.map((p) => (p.id === renamingId ? { ...p, name } : p)) };
        }
        const src = BUILTIN_PRESETS.find((p) => p.id === renamingId);
        return src ? { ...c, presets: [...c.presets, { ...clonePreset(src), name }] } : c;
      });
      if (draft?.id === renamingId) setDraft((d) => (d ? { ...d, name } : d));
      setDirty(true);
    }
    setRenamingId(null);
  }

  /** reset-one: built-ins restore their factory token; customs drop it */
  function resetToken(key: TokenKey) {
    if (!draft) return;
    const factory = draft.builtIn ? BUILTIN_PRESETS.find((p) => p.id === draft.id) : null;
    const original = factory?.tokens[key];
    setToken(key, original ? { ...original } : null);
  }

  const factoryToken = (key: TokenKey): ColorValue | null => {
    if (!draft) return null;
    if (draft.builtIn) return BUILTIN_PRESETS.find((p) => p.id === draft.id)?.tokens[key] ?? null;
    return draft.tokens[key] ?? null;
  };

  const allPresets = [
    ...BUILTIN_PRESETS.map((p) => config.presets.find((c) => c.id === p.id) ?? p),
    ...config.presets.filter((c) => !c.builtIn),
  ];

  const warnings = useMemo(() => (draft ? contrastWarnings(draft.tokens) : []), [draft]);
  const previewVars = useMemo(() => (draft ? themePresetToVars(draft) : {}), [draft]);

  if (!loaded) {
    return <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>;
  }

  // ---------- field renderers ----------
  const colorField = (key: TokenKey, labelAr: string, hintAr?: string) => {
    const val = draft?.tokens[key] ?? null;
    const hex = val?.hex ?? '#ffffff';
    const alpha = val?.alpha ?? 100;
    const factory = factoryToken(key);
    return (
      <div key={key} className="rounded-2xl border border-border/50 bg-card p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <Label className="text-xs font-black">{labelAr}</Label>
            {hintAr && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{hintAr}</p>}
          </div>
          {val && factory && (factory.hex !== val.hex || factory.alpha !== val.alpha) && (
            <button
              type="button"
              onClick={() => resetToken(key)}
              title="إعادة تعيين هذا اللون فقط"
              aria-label={`إعادة تعيين ${labelAr}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          {!factory && val && (
            <button
              type="button"
              onClick={() => resetToken(key)}
              title="إزالة هذا اللون (رجوع للافتراضي)"
              aria-label={`إزالة ${labelAr}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <label className="relative h-9 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border shadow-sm" style={{ background: colorToCss(val) ?? 'transparent' }}>
            <input
              type="color"
              value={hex}
              onChange={(e) => setToken(key, { hex: e.target.value, alpha })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={`منتقي اللون — ${labelAr}`}
            />
          </label>
          <Input
            dir="ltr"
            className="h-9 w-24 text-left text-xs tabular-nums"
            value={hex}
            onChange={(e) => {
              const n = normalizeHex(e.target.value);
              if (n) setToken(key, { hex: n, alpha });
              else if (e.target.value === '' || e.target.value === '#') setToken(key, { hex: hex, alpha });
            }}
            aria-label={`كود اللون — ${labelAr}`}
          />
          <div className="flex flex-1 items-center gap-2">
            <Slider
              value={[alpha]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setToken(key, { hex, alpha: v[0] ?? 100 })}
              aria-label={`الشفافية — ${labelAr}`}
            />
            <span className="w-10 shrink-0 text-left text-[11px] font-bold tabular-nums text-muted-foreground" dir="ltr">
              {alpha}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  const bgField = () => {
    const b = draft?.background ?? DEFAULT_BG;
    const modeBtn = (mode: ThemeBackground['mode'], label: string) => (
      <button
        key={mode}
        type="button"
        onClick={() => setBackground({ mode })}
        className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all ${
          b.mode === mode ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border/60 bg-card text-foreground/70 hover:border-primary/40'
        }`}
        aria-pressed={b.mode === mode}
      >
        {label}
      </button>
    );
    const alphaRow = (label: string, c: ColorValue | null | undefined, onChange: (v: ColorValue) => void) =>
      c ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="w-14 text-[11px] font-bold text-muted-foreground">{label}</span>
          <Slider
            value={[c.alpha]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => onChange({ ...c, alpha: v[0] ?? 100 })}
          />
          <span className="w-10 text-left text-[11px] font-bold tabular-nums text-muted-foreground" dir="ltr">
            {c.alpha}%
          </span>
        </div>
      ) : null;

    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-black">
          <ImageIcon className="h-4 w-4 text-primary" aria-hidden />
          الخلفية المتقدمة
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {modeBtn('solid', 'لون ثابت')}
          {modeBtn('gradient', 'تدرج')}
          {modeBtn('transparent', 'شفافية')}
          {modeBtn('image', 'صورة')}
          {modeBtn('image-overlay', 'صورة + طبقة')}
        </div>

        {b.mode === 'solid' && (
          <div className="mt-4">
            {colorFieldInline('لون الخلفية', b.color ?? { hex: '#faf6ef', alpha: 100 }, (v) => setBackground({ color: v }))}
            {alphaRow('الشفافية', b.color, (v) => setBackground({ color: v }))}
          </div>
        )}

        {b.mode === 'gradient' && b.gradient && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <label className="relative h-9 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border" style={{ background: colorToCss(b.gradient.from) }}>
                  <input
                    type="color"
                    value={b.gradient.from.hex}
                    onChange={(e) => setBackground({ gradient: { ...b.gradient!, from: { ...b.gradient!.from, hex: e.target.value } } })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="اللون الأول للتدرج"
                  />
                </label>
                <Input
                  dir="ltr"
                  className="h-9 w-24 text-left text-xs"
                  value={b.gradient.from.hex}
                  onChange={(e) => {
                    const n = normalizeHex(e.target.value);
                    if (n) setBackground({ gradient: { ...b.gradient!, from: { ...b.gradient!.from, hex: n } } });
                  }}
                  aria-label="كود اللون الأول"
                />
                <span className="text-[11px] text-muted-foreground">الأول</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative h-9 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border" style={{ background: colorToCss(b.gradient.to) }}>
                  <input
                    type="color"
                    value={b.gradient.to.hex}
                    onChange={(e) => setBackground({ gradient: { ...b.gradient!, to: { ...b.gradient!.to, hex: e.target.value } } })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="اللون الثاني للتدرج"
                  />
                </label>
                <Input
                  dir="ltr"
                  className="h-9 w-24 text-left text-xs"
                  value={b.gradient.to.hex}
                  onChange={(e) => {
                    const n = normalizeHex(e.target.value);
                    if (n) setBackground({ gradient: { ...b.gradient!, to: { ...b.gradient!.to, hex: n } } });
                  }}
                  aria-label="كود اللون الثاني"
                />
                <span className="text-[11px] text-muted-foreground">الثاني</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-[11px] font-bold text-muted-foreground">النوع</span>
              <Select value={b.gradient.type} onValueChange={(v) => setBackground({ gradient: { ...b.gradient!, type: v as 'linear' | 'radial' } })}>
                <SelectTrigger className="h-9 w-32 rounded-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">خطي Linear</SelectItem>
                  <SelectItem value="radial">دائري Radial</SelectItem>
                </SelectContent>
              </Select>
              {b.gradient.type === 'linear' && (
                <div className="flex flex-1 items-center gap-2">
                  <span className="shrink-0 text-[11px] font-bold text-muted-foreground">الاتجاه</span>
                  <Slider
                    value={[b.gradient.angle]}
                    min={0}
                    max={360}
                    step={5}
                    onValueChange={(v) => setBackground({ gradient: { ...b.gradient!, angle: v[0] ?? 180 } })}
                    aria-label="اتجاه التدرج"
                  />
                  <span className="w-10 text-left text-[11px] font-bold tabular-nums text-muted-foreground" dir="ltr">
                    {b.gradient.angle}°
                  </span>
                </div>
              )}
            </div>
            {alphaRow('شفافية الأول', b.gradient.from, (v) => setBackground({ gradient: { ...b.gradient!, from: v } }))}
            {alphaRow('شفافية الثاني', b.gradient.to, (v) => setBackground({ gradient: { ...b.gradient!, to: v } }))}
            <div className="rounded-xl px-3 py-2 text-center text-[11px] font-bold" style={{ backgroundImage: previewVars['--page-bg-image'] ? undefined : undefined, background: 'transparent' }}>
              <span dir="ltr" className="text-muted-foreground">
                {b.gradient.from.hex} → {b.gradient.to.hex}
              </span>
            </div>
          </div>
        )}

        {(b.mode === 'image' || b.mode === 'image-overlay') && (
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs font-black">رابط الصورة</Label>
              <Input
                dir="ltr"
                className="mt-1.5 h-9 text-left text-xs"
                placeholder="https://…/background.jpg"
                value={b.image}
                onChange={(e) => setBackground({ image: e.target.value })}
              />
            </div>
            {b.mode === 'image-overlay' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-20 text-[11px] font-bold text-muted-foreground">لون الطبقة</span>
                  <label className="relative h-9 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border" style={{ background: b.overlayColor }}>
                    <input
                      type="color"
                      value={b.overlayColor}
                      onChange={(e) => setBackground({ overlayColor: e.target.value })}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label="لون طبقة التعتيم"
                    />
                  </label>
                  <Input
                    dir="ltr"
                    className="h-9 w-24 text-left text-xs"
                    value={b.overlayColor}
                    onChange={(e) => {
                      const n = normalizeHex(e.target.value);
                      if (n) setBackground({ overlayColor: n });
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[11px] font-bold text-muted-foreground">قوة التعتيم</span>
                  <Slider value={[b.overlayAlpha]} min={0} max={100} step={1} onValueChange={(v) => setBackground({ overlayAlpha: v[0] ?? 45 })} />
                  <span className="w-10 text-left text-[11px] font-bold tabular-nums text-muted-foreground" dir="ltr">
                    {b.overlayAlpha}%
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  /** inline single-row color editor (used inside the background card) */
  function colorFieldInline(label: string, c: ColorValue, onChange: (v: ColorValue) => void) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-14 text-[11px] font-bold text-muted-foreground">{label}</span>
        <label className="relative h-9 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border" style={{ background: colorToCss(c) }}>
          <input
            type="color"
            value={c.hex}
            onChange={(e) => onChange({ ...c, hex: e.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
        <Input
          dir="ltr"
          className="h-9 w-24 text-left text-xs"
          value={c.hex}
          onChange={(e) => {
            const n = normalizeHex(e.target.value);
            if (n) onChange({ ...c, hex: n });
          }}
        />
      </div>
    );
  }

  // ---------- render ----------
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <p className="rounded-2xl border border-primary/20 bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">🎨 هوية الموقع:</strong> تحكّمي كامل في ألوان واجهة الموقع بالكامل — كل لون له منتقي + كود Hex + شفافية، والتغييرات تنعكس على المتجر بالكامل فورًا (بدون فلاش ألوان قديمة) وتُحفظ في قاعدة البيانات فتظهر نفسها من أي جهاز.
      </p>

      {/* presets strip */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black">الثيمات</h3>
          {creating ? (
            <div className="flex items-center gap-2">
              <Input className="h-9 w-40 text-xs" placeholder="اسم الثيم الجديد" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createTheme()} autoFocus />
              <Button size="sm" className="h-9 rounded-full bg-primary text-xs font-bold text-primary-foreground" onClick={createTheme}>
                <Check className="ml-1 h-3.5 w-3.5" aria-hidden /> إنشاء
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-9 rounded-full text-xs font-bold" onClick={() => setCreating(true)}>
              <Plus className="ml-1 h-3.5 w-3.5" aria-hidden /> إنشاء Theme جديد
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allPresets.map((p) => {
            const selected = draft?.id === p.id;
            const savedActive = config.activeId === p.id;
            const dots = [p.tokens.primary?.hex ?? '#9d4e45', p.tokens.background?.hex ?? '#faf6ef', p.tokens.accent?.hex ?? '#eed9c6'];
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl border p-3 transition-all ${selected ? 'border-primary bg-secondary/50 shadow-md' : 'border-border/50 bg-background hover:border-primary/30'}`}
              >
                {savedActive && !dirty && (
                  <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground" title="مُطبَّق حاليًا">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                )}
                <button type="button" onClick={() => selectPreset(p)} className="block w-full text-right" aria-pressed={selected}>
                  <span className="flex gap-1.5" aria-hidden>
                    {dots.map((c, i) => (
                      <span key={i} className="h-6 w-6 rounded-full border border-black/5 shadow-sm" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  {renamingId === p.id ? (
                    <span className="mt-2 flex items-center gap-1">
                      <Input className="h-7 text-xs" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitRename()} autoFocus />
                      <button type="button" onClick={commitRename} className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground" aria-label="تأكيد الاسم">
                        <Check className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ) : (
                    <span className="mt-2 flex items-center gap-1.5 text-xs font-black">
                      {p.name}
                      {p.builtIn && <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">أساسي</Badge>}
                    </span>
                  )}
                </button>
                <div className="mt-2 flex items-center gap-1">
                  <button type="button" onClick={() => duplicate(p.id)} title="نسخ الثيم" aria-label="نسخ الثيم" className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Copy className="h-3 w-3" aria-hidden />
                  </button>
                  {renamingId !== p.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(p.id);
                        setRenameVal(p.name);
                      }}
                      title="إعادة تسمية"
                      aria-label="إعادة تسمية"
                      className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button type="button" title="حذف الثيم" aria-label="حذف الثيم" className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3 w-3" aria-hidden />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف «{p.name}»؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف الثيم من قائمة الثيمات. لا يمكن التراجع.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeTheme(p.id)} className="bg-destructive text-white hover:bg-destructive/90">
                          حذف
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* live preview */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black">معاينة حية</h3>
          {dirty && <span className="text-[11px] font-bold text-accent-foreground rounded-full bg-accent px-2.5 py-1">تغييرات غير محفوظة</span>}
        </div>

        {/* the mock sits in a subtree themed by the draft's own vars */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 shadow-sm" style={previewVars as React.CSSProperties}>
          <div className="text-foreground" style={{ background: 'var(--background)', backgroundImage: 'var(--page-bg-image, none)', backgroundSize: 'cover' }}>
            {/* header strip */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5" style={{ background: 'var(--color-header, color-mix(in srgb, var(--background) 85%, transparent))' }}>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">L</span>
              <strong className="text-xs" dir="ltr">LUBNÉL</strong>
              <span className="mr-auto inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
                <span className="grid h-3.5 w-3.5 place-items-center rounded-full" style={{ background: 'var(--color-badge, var(--accent))', color: 'var(--color-badge-foreground, var(--accent-foreground))' }}>1</span>
                الحقيبة
              </span>
            </div>
            {/* body */}
            <div className="p-4">
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold">بوكس الجامعة الفاخر</p>
                    <p className="mt-0.5 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>مفضّلة عند عميلاتنا هذا الشهر</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: 'var(--color-badge, var(--primary))', color: 'var(--color-badge-foreground, var(--primary-foreground))' }}>
                    الأكثر طلبًا
                  </span>
                </div>
                <p className="mt-2 text-sm font-black text-primary" style={{ color: 'var(--primary)' }}>
                  400 <span className="text-[10px]">ج.م</span>
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="rounded-full px-3.5 py-1.5 text-[10px] font-bold text-primary-foreground" style={{ background: 'var(--color-button, var(--primary))' }}>
                    أضيفي إلى السلة
                  </span>
                  <span className="rounded-full border border-border px-3.5 py-1.5 text-[10px] font-bold" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
                    التفاصيل
                  </span>
                  <span className="text-[10px] font-bold underline" style={{ color: 'var(--color-link, var(--primary))' }}>
                    عرض الكل
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border px-3 py-2" style={{ background: 'var(--input)' }}>
                  <p className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>البريد الإلكتروني</p>
                  <p className="text-[10px] font-bold" dir="ltr">mail@lubnel.com</p>
                </div>
                <div className="rounded-xl border border-border px-3 py-2" style={{ background: 'var(--muted)' }}>
                  <p className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>خلفية ثانوية / Muted</p>
                  <p className="text-[10px] font-bold">شريحة خفيفة</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* contrast warnings — warning only, never blocking */}
        {warnings.length > 0 && (
          <div className="mt-3 space-y-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            {warnings.map((w, i) => (
              <p key={i} className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ⚠️ التباين منخفض وقد يؤثر على سهولة القراءة — {w.labelAr} ({w.ratio}:1)
              </p>
            ))}
          </div>
        )}
      </div>

      {/* token groups */}
      {TOKEN_GROUPS.map((g) => {
        const tokens = THEME_TOKENS.filter((t) => t.group === g.key);
        // Effects group = shadow token + the advanced background editor
        const effects = g.key === 'effects';
        return (
          <div key={g.key} className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="text-sm font-black">
              {g.icon} {g.labelAr}
            </h3>
            {effects ? (
              <>
                <div className="mt-3">{colorField('shadow', THEME_TOKENS.find((t) => t.key === 'shadow')!.labelAr, 'يمسّ ظلال البطاقات والمودالات')}</div>
                <div className="mt-3">{bgField()}</div>
              </>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {tokens.map((t) => colorField(t.key, t.labelAr, t.hintAr))}
              </div>
            )}
          </div>
        );
      })}

      {/* save / reset */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-lg backdrop-blur">
        <Button onClick={save} disabled={saving || !draft} className="h-11 flex-1 rounded-full bg-primary font-bold text-primary-foreground sm:flex-none sm:px-8">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="ml-1 h-4 w-4" aria-hidden />}
          حفظ وتطبيق على الموقع
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="h-11 rounded-full font-bold text-destructive hover:bg-destructive/10 hover:text-destructive">
              <RotateCcw className="ml-1 h-4 w-4" aria-hidden /> Reset Theme
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>إعادة تعيين الهوية بالكامل؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف كل الثيمات المخصصة والإعدادات والعودة إلى الثيم الافتراضي لـ لوبنيل. لا يمكن التراجع.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={resetAll} className="bg-destructive text-white hover:bg-destructive/90">
                نعم، إعادة التعيين
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="w-full text-center text-[10px] text-muted-foreground sm:w-auto sm:flex-1">
          نص الأزرار فوق الألوان يُحسب تلقائيًا لضمان الوضوح
        </p>
      </div>
    </div>
  );
}
