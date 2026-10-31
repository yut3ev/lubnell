'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Smartphone,
  Laptop,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  Check,
  AlertTriangle,
  History,
  Clock,
  Palette,
  Layers,
  Calendar,
  Link as LinkIcon,
  Eye,
  Sliders,
  Flower2,
  Truck,
  Gift,
  Tag,
  Star,
  Highlighter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiJson, type AdminInfo } from '../helpers';
import {
  AnnouncementBar,
  ANNOUNCE_THEMES,
} from '@/components/store/announcement-bar';
import {
  DEFAULT_ANNOUNCE_CONFIG,
  type AnnounceBarConfig,
  type AnnounceMessage,
} from '@/app/api/announce/route';
import { type AdminInfo } from '../helpers';

// WCAG Contrast Calculation
function getLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, '$&$&') : clean;
  const r = parseInt(full.substring(0, 2), 16) / 255;
  const g = parseInt(full.substring(2, 4), 16) / 255;
  const b = parseInt(full.substring(4, 6), 16) / 255;
  const a = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1: string, hex2: string): number {
  if (!/^#[0-9a-fA-F]{3,8}$/.test(hex1) || !/^#[0-9a-fA-F]{3,8}$/.test(hex2)) return 21;
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isDarkColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/./g, '$&$&') : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

const ICON_OPTIONS: { id: AnnounceMessage['icon']; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'flower', label: 'وردة', icon: Flower2 },
  { id: 'truck', label: 'شاحنة', icon: Truck },
  { id: 'gift', label: 'هدية', icon: Gift },
  { id: 'tag', label: 'وسام / خصم', icon: Tag },
  { id: 'star', label: 'نجمة', icon: Star },
];

export function AnnounceSection({ admin: _admin }: { admin?: AdminInfo }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AnnounceBarConfig>(DEFAULT_ANNOUNCE_CONFIG);
  const [initialSaved, setInitialSaved] = useState<AnnounceBarConfig>(DEFAULT_ANNOUNCE_CONFIG);
  const [history, setHistory] = useState<{ version: number; updatedAt: string; adminName?: string; config: AnnounceBarConfig }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [customColorsOpen, setCustomColorsOpen] = useState(false);
  const activeInputRef = useRef<{ id: string; start: number; end: number } | null>(null);

  // Load config & history
  const loadData = async () => {
    setLoading(true);
    try {
      const { ok, data } = await apiJson<{ ok: boolean; config: AnnounceBarConfig; history: any[] }>('/api/admin/announce');
      if (ok && data?.ok && data.config) {
        setConfig(data.config);
        setInitialSaved(data.config);
        if (Array.isArray(data.history)) setHistory(data.history);
        const hasCustom = Boolean(
          data.config.colors?.bg ||
          data.config.colors?.fg ||
          data.config.colors?.hi ||
          data.config.colors?.flags?.length
        );
        setCustomColorsOpen(hasCustom);
      }
    } catch {
      toast({ title: 'تعذر التحميل', description: 'تأكدي من الاتصال بالإنترنت', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(initialSaved);
  }, [config, initialSaved]);

  // Save handler
  const handleSave = async () => {
    setSaving(true);
    try {
      const { ok, data } = await apiJson<{ ok: boolean; config: AnnounceBarConfig; error?: string }>('/api/admin/announce', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (ok && data?.ok) {
        toast({ title: 'تم الحفظ والنشر بنجاح 🌸', description: 'سينعكس الشريط في المتجر للعميلات فورًا.' });
        setConfig(data.config);
        setInitialSaved(data.config);
        loadData();
      } else {
        toast({ title: 'خطأ في الحفظ', description: data?.error || 'تحققي من البيانات المدخلة', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'فشل الحفظ', description: 'تعذر الاتصال بالسيرفر', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Restore handler
  const handleRestore = async (version: number) => {
    if (!confirm(`هل أنتِ متأكدة من استرجاع النسخة رقم ${version}؟`)) return;
    try {
      const { ok, data } = await apiJson<{ ok: boolean; config: AnnounceBarConfig; error?: string }>('/api/admin/announce', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', version }),
      });
      if (ok && data?.ok) {
        toast({ title: 'تم استرجاع النسخة بنجاح 🌸' });
        setShowHistory(false);
        loadData();
      } else {
        toast({ title: 'فشل الاسترجاع', description: data?.error || 'حدث خطأ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالسيرفر', variant: 'destructive' });
    }
  };

  // Revert changes to initial saved
  const handleRevert = () => {
    setConfig(initialSaved);
    toast({ title: 'تم التراجع عن التغييرات غير المحفوظة' });
  };

  // Message Operations
  const addMessage = () => {
    const activeCount = config.messages.filter((m) => m.active).length;
    if (activeCount >= 8) {
      toast({ title: 'الحد الأقصى 8 رسائل', description: 'لا يمكن تفعيل أكثر من 8 رسائل في نفس الوقت.', variant: 'destructive' });
      return;
    }
    const newMsg: AnnounceMessage = {
      id: `msg_${Date.now()}`,
      icon: 'flower',
      text: 'رسالة إعلانية جديدة {b}مميزة{/b}',
      href: null,
      active: true,
      from: null,
      to: null,
      order: config.messages.length + 1,
    };
    setConfig((prev) => ({
      ...prev,
      messages: [...prev.messages, newMsg],
    }));
  };

  const removeMessage = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => m.id !== id),
    }));
  };

  const updateMessage = (id: string, updates: Partial<AnnounceMessage>) => {
    setConfig((prev) => ({
      ...prev,
      messages: prev.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  };

  const moveMessage = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= config.messages.length) return;
    const msgs = [...config.messages];
    const temp = msgs[idx];
    msgs[idx] = msgs[targetIdx];
    msgs[targetIdx] = temp;
    setConfig((prev) => ({ ...prev, messages: msgs }));
  };

  // Highlight selected text with {b}...{/b}
  const highlightSelection = (msgId: string) => {
    const msg = config.messages.find((m) => m.id === msgId);
    if (!msg) return;
    const info = activeInputRef.current;
    if (!info || info.id !== msgId || info.start === info.end) {
      toast({ title: 'حددي الكلمة أولاً', description: 'ظللي النص الذي تريدين تمييزه ثم اضغطي زر التمييز.' });
      return;
    }
    const { start, end } = info;
    const text = msg.text;
    const selected = text.substring(start, end);
    // If already wrapped in {b}, unwrap it
    let newText = '';
    if (selected.startsWith('{b}') && selected.endsWith('{/b}')) {
      newText = text.substring(0, start) + selected.replace(/^\{b\}|\{\/b\}$/g, '') + text.substring(end);
    } else {
      newText = text.substring(0, start) + `{b}${selected}{/b}` + text.substring(end);
    }
    if (newText.length > 90) {
      toast({ title: 'النص يتجاوز 90 حرف', variant: 'destructive' });
      return;
    }
    updateMessage(msgId, { text: newText });
  };

  // Resolved Theme Colors & Contrast Check
  const currentThemeBase = ANNOUNCE_THEMES[config.theme] || ANNOUNCE_THEMES.rose;
  const resolvedBg = config.colors?.bg || currentThemeBase.bg;
  let resolvedFg = config.colors?.fg || currentThemeBase.fg;
  if (config.colors?.bg && !config.colors?.fg) {
    resolvedFg = isDarkColor(resolvedBg) ? '#ffffff' : '#4a2230';
  }
  const contrastRatio = getContrastRatio(resolvedFg, resolvedBg);
  const isContrastLow = contrastRatio < 4.5;

  const activeMessagesCount = config.messages.filter((m) => m.active).length;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm font-bold text-muted-foreground">جارٍ تحميل إعدادات شريط الإعلانات…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#8a3a46]/10 text-[#8a3a46]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">شريط الإعلانات</h1>
              <p className="text-xs text-muted-foreground">
                التحكم الكامل في شريط العروض والزهور والأعلام أعلى المتجر لحظيًا.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-full gap-1.5"
          >
            <History className="h-4 w-4" />
            <span>سجل النسخ ({history.length})</span>
          </Button>

          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevert}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              <span>تراجع</span>
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="rounded-full bg-[#8a3a46] px-6 font-bold text-white shadow-md hover:bg-[#5a2230] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'جارٍ الحفظ…' : 'حفظ ونشر'}</span>
          </Button>
        </div>
      </div>

      {/* History Drawer/Panel */}
      {showHistory && (
        <div className="rounded-3xl border border-[#ecd9d1] bg-[#fffaf8] p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#ecd9d1] pb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#7a2e3b]">
              <History className="h-4 w-4" />
              سجل آخر 10 نسخ محفوظة (إمكانية الاسترجاع بنقرة واحدة)
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="h-7 text-xs">
              إغلاق
            </Button>
          </div>
          {history.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا يوجد نسخ سابقة محفوظة بعد.</p>
          ) : (
            <div className="mt-3 divide-y divide-[#ecd9d1]/60">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <span className="font-bold text-[#3a2226]">النسخة #{h.version}</span>
                    <span className="mx-2 text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {new Date(h.updatedAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    {h.adminName && <span className="ms-2 rounded bg-white px-2 py-0.5 text-[10px] border">بواسطة: {h.adminName}</span>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(h.version)}
                    className="h-8 rounded-full border-[#8a3a46]/30 text-xs font-bold text-[#8a3a46] hover:bg-[#8a3a46] hover:text-white"
                  >
                    استرجاع هذه النسخة
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Group E: Live Preview (المعاينة الحية) */}
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#8a3a46]" />
            <h2 className="text-sm font-black">معاينة حية للشريط (تتحدث تلقائيًا مع أي تعديل)</h2>
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-[11px] font-bold text-emerald-700">
              مباشر قبل الحفظ
            </Badge>
          </div>

          <div className="flex items-center rounded-full border border-border bg-secondary/50 p-1">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                previewDevice === 'desktop' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>كمبيوتر / لاب</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                previewDevice === 'mobile' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>موبايل (390px)</span>
            </button>
          </div>
        </div>

        {/* Live Preview Container */}
        <div className="flex justify-center overflow-x-auto rounded-2xl bg-[#fbeee9]/40 p-4 pt-6">
          <div
            className="transition-all duration-300"
            style={{
              width: previewDevice === 'mobile' ? '390px' : '100%',
              maxWidth: previewDevice === 'mobile' ? '390px' : '100%',
            }}
          >
            <AnnouncementBar previewConfig={config} isMobilePreview={previewDevice === 'mobile'} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Group A: الرسايل (قائمة قابلة للتعديل) */}
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black">الرسائل الإعلانية</h2>
                <Badge
                  variant="outline"
                  className={activeMessagesCount > 8 ? 'bg-red-50 text-red-700' : 'bg-primary/10 text-primary font-bold'}
                >
                  {activeMessagesCount} / 8 مفعّلة
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                رتب الرسائل، عيّن أيقونات وروابط، وظللي أي كلمة واضغطي &quot;تمييز 🪄&quot; لتلوينها بالأصفر.
              </p>
            </div>

            <Button
              onClick={addMessage}
              disabled={config.messages.length >= 12}
              size="sm"
              className="rounded-full bg-[#8a3a46] text-xs font-bold text-white hover:bg-[#5a2230]"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة رسالة جديدة</span>
            </Button>
          </div>

          {activeMessagesCount === 0 && (
            <div className="my-4 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3.5 text-xs font-bold text-amber-800">
              ⚠️ لا توجد رسائل مفعّلة حاليًا — سيختفي الشريط تلقائيًا من المتجر حتى يتم تفعيل رسالة واحدة على الأقل.
            </div>
          )}

          <div className="mt-4 space-y-4">
            {config.messages.map((msg, idx) => {
              const charCount = (msg.text || '').length;
              return (
                <div
                  key={msg.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    msg.active ? 'border-border/80 bg-card shadow-sm' : 'border-dashed border-border/60 bg-secondary/20 opacity-70'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveMessage(idx, 'up')}
                          aria-label="تحريك لأعلى"
                          className="rounded-lg p-1 hover:bg-secondary disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === config.messages.length - 1}
                          onClick={() => moveMessage(idx, 'down')}
                          aria-label="تحريك لأسفل"
                          className="rounded-lg p-1 hover:bg-secondary disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="font-mono text-xs font-bold text-muted-foreground">#{idx + 1}</span>

                      {/* Icon selector */}
                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2 py-1">
                        {ICON_OPTIONS.map((opt) => {
                          const IconComp = opt.icon;
                          const isSelected = msg.icon === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => updateMessage(msg.id, { icon: opt.id })}
                              title={opt.label}
                              className={`grid h-7 w-7 place-items-center rounded-full transition-all ${
                                isSelected ? 'bg-[#8a3a46] text-white shadow-sm' : 'text-muted-foreground hover:bg-white'
                              }`}
                            >
                              <IconComp className="h-3.5 w-3.5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                        <span>{msg.active ? 'مفعّلة' : 'معطلة'}</span>
                        <Switch
                          checked={msg.active}
                          onCheckedChange={(checked) => updateMessage(msg.id, { active: checked })}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeMessage(msg.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        title="حذف الرسالة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Text Input + Highlight button */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-foreground">نص الإعلان</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => highlightSelection(msg.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#ebd8d0] bg-[#fffaf8] px-2 py-0.5 text-[11px] font-bold text-[#8a3a46] hover:bg-[#fbeee9]"
                          title="ظللي كلمة ثم اضغطي لتمييزها"
                        >
                          <Highlighter className="h-3 w-3" />
                          <span>تمييز بالأصفر 🪄</span>
                        </button>
                        <span className={`font-mono font-bold ${charCount > 85 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {charCount} / 90
                        </span>
                      </div>
                    </div>

                    <input
                      value={msg.text}
                      maxLength={90}
                      onChange={(e) => updateMessage(msg.id, { text: e.target.value })}
                      onSelect={(e) => {
                        const target = e.currentTarget;
                        activeInputRef.current = {
                          id: msg.id,
                          start: target.selectionStart || 0,
                          end: target.selectionEnd || 0,
                        };
                      }}
                      placeholder="اكتبي نص الإعلان هنا..."
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-[#8a3a46]"
                    />
                  </div>

                  {/* Link & Schedule */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                        <LinkIcon className="inline h-3 w-3 me-1" /> الرابط (اختياري)
                      </label>
                      <input
                        value={msg.href || ''}
                        onChange={(e) => updateMessage(msg.id, { href: e.target.value || null })}
                        placeholder="/c/all أو https://..."
                        dir="ltr"
                        className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs font-mono outline-none focus:border-[#8a3a46]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                        <Calendar className="inline h-3 w-3 me-1" /> تاريخ البدء (اختياري)
                      </label>
                      <input
                        type="datetime-local"
                        value={msg.from ? msg.from.slice(0, 16) : ''}
                        onChange={(e) => updateMessage(msg.id, { from: e.target.value || null })}
                        className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-[#8a3a46]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                        <Clock className="inline h-3 w-3 me-1" /> تاريخ الانتهاء (اختياري)
                      </label>
                      <input
                        type="datetime-local"
                        value={msg.to ? msg.to.slice(0, 16) : ''}
                        onChange={(e) => updateMessage(msg.id, { to: e.target.value || null })}
                        className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-[#8a3a46]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Group B: الثيم والألوان (Theme) */}
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6 space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-base font-black flex items-center gap-2">
              <Palette className="h-4 w-4 text-[#8a3a46]" />
              الثيم والألوان
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              اختاري من الثيمات الجاهزة أو حددي درجات ألوان مخصصة بالكامل.
            </p>
          </div>

          {/* 4 Ready-made Themes */}
          <div>
            <label className="mb-2 block text-xs font-bold text-foreground">الثيمات الجاهزة:</label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(['rose', 'peach', 'sage', 'lilac'] as const).map((thKey) => {
                const th = ANNOUNCE_THEMES[thKey];
                const isSelected = config.theme === thKey && !customColorsOpen;
                const labels: Record<string, string> = {
                  rose: 'ورد (الافتراضي)',
                  peach: 'خوخ',
                  sage: 'سيدج',
                  lilac: 'ليلكي',
                };
                return (
                  <button
                    key={thKey}
                    type="button"
                    onClick={() => {
                      setConfig((prev) => ({
                        ...prev,
                        theme: thKey,
                        colors: { bg: null, fg: null, hi: null, rope: null, stem: null, flags: [] },
                      }));
                      setCustomColorsOpen(false);
                    }}
                    className={`flex flex-col items-center rounded-2xl border p-2.5 text-center transition-all ${
                      isSelected
                        ? 'border-[#8a3a46] bg-primary/5 ring-2 ring-[#8a3a46]/30'
                        : 'border-border bg-secondary/20 hover:border-border/80'
                    }`}
                  >
                    <div
                      className="h-9 w-full rounded-xl flex items-center justify-center gap-1 shadow-inner"
                      style={{ backgroundColor: th.bg }}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: th.hi }} />
                      <span className="h-2 w-7 rounded-full" style={{ backgroundColor: th.fg }} />
                    </div>
                    <span className="mt-2 text-xs font-extrabold">{labels[thKey]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contrast Warning */}
          {isContrastLow && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-800"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span>تحذير تباين ضعيف ({contrastRatio.toFixed(1)}:1 أقل من 4.5:1)</span>
                <p className="font-normal text-[11px] mt-0.5 text-amber-700">
                  التباين بين لون النص ولون الخلفية غير كافٍ لمعايير سهولة القراءة (WCAG AA). يُفضل اختيار لون نص أفتح أو أغمق.
                </p>
              </div>
            </div>
          )}

          {/* Custom Colors Accordion / Section */}
          <div className="rounded-2xl border border-border/80 p-3.5 bg-secondary/15">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold block">ألوان مخصصة</span>
                <span className="text-[11px] text-muted-foreground">تخصيص الخلفية، النص، الأعلام، والحبل</span>
              </div>
              <Switch
                checked={customColorsOpen}
                onCheckedChange={(on) => {
                  setCustomColorsOpen(on);
                  if (!on) {
                    setConfig((prev) => ({
                      ...prev,
                      colors: { bg: null, fg: null, hi: null, rope: null, stem: null, flags: [] },
                    }));
                  }
                }}
              />
            </div>

            {customColorsOpen && (
              <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-[11px] font-bold block mb-1">الخلفية (bg)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={config.colors?.bg || currentThemeBase.bg}
                        onChange={(e) => {
                          const newBg = e.target.value;
                          const autoFg = isDarkColor(newBg) ? '#ffffff' : '#4a2230';
                          setConfig((prev) => ({
                            ...prev,
                            colors: { ...prev.colors, bg: newBg, fg: prev.colors?.fg || autoFg },
                          }));
                        }}
                        className="h-8 w-8 rounded-lg cursor-pointer border"
                      />
                      <input
                        value={config.colors?.bg || ''}
                        onChange={(e) => setConfig((prev) => ({ ...prev, colors: { ...prev.colors, bg: e.target.value || null } }))}
                        placeholder={currentThemeBase.bg}
                        className="h-8 w-20 text-xs font-mono rounded-lg border px-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold block mb-1">النص (fg)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={config.colors?.fg || currentThemeBase.fg}
                        onChange={(e) => setConfig((prev) => ({ ...prev, colors: { ...prev.colors, fg: e.target.value } }))}
                        className="h-8 w-8 rounded-lg cursor-pointer border"
                      />
                      <input
                        value={config.colors?.fg || ''}
                        onChange={(e) => setConfig((prev) => ({ ...prev, colors: { ...prev.colors, fg: e.target.value || null } }))}
                        placeholder={currentThemeBase.fg}
                        className="h-8 w-20 text-xs font-mono rounded-lg border px-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold block mb-1">التمييز والأيقونات (hi)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={config.colors?.hi || currentThemeBase.hi}
                        onChange={(e) => setConfig((prev) => ({ ...prev, colors: { ...prev.colors, hi: e.target.value } }))}
                        className="h-8 w-8 rounded-lg cursor-pointer border"
                      />
                      <input
                        value={config.colors?.hi || ''}
                        onChange={(e) => setConfig((prev) => ({ ...prev, colors: { ...prev.colors, hi: e.target.value || null } }))}
                        placeholder={currentThemeBase.hi}
                        className="h-8 w-20 text-xs font-mono rounded-lg border px-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold block mb-1">الحبل (rope)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={config.colors?.rope || currentThemeBase.rope}
                        onChange={(e) => setConfig((prev) => ({ ...prev, colors: { ...prev.colors, rope: e.target.value } }))}
                        className="h-8 w-8 rounded-lg cursor-pointer border"
                      />
                      <input
                        value={config.colors?.rope || ''}
                        onChange={(e) => setConfig((prev) => ({ ...prev, colors: { ...prev.colors, rope: e.target.value || null } }))}
                        placeholder={currentThemeBase.rope}
                        className="h-8 w-20 text-xs font-mono rounded-lg border px-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold block mb-1">سيقان الزهور (stem)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={config.colors?.stem || currentThemeBase.stem}
                        onChange={(e) => setConfig((prev) => ({ ...prev, colors: { ...prev.colors, stem: e.target.value } }))}
                        className="h-8 w-8 rounded-lg cursor-pointer border"
                      />
                      <input
                        value={config.colors?.stem || ''}
                        onChange={(e) => setConfig((prev) => ({ ...prev, colors: { ...prev.colors, stem: e.target.value || null } }))}
                        placeholder={currentThemeBase.stem}
                        className="h-8 w-20 text-xs font-mono rounded-lg border px-1.5"
                      />
                    </div>
                  </div>
                </div>

                {/* Flags Colors Picker (2 to 6 colors) */}
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold">ألوان الأعلام المعلقة (2 - 6 ألوان):</span>
                    <button
                      type="button"
                      onClick={() => {
                        const curFlags = config.colors?.flags?.length ? config.colors.flags : currentThemeBase.flags;
                        if (curFlags.length >= 6) return;
                        setConfig((prev) => ({
                          ...prev,
                          colors: { ...prev.colors, flags: [...curFlags, '#f9e7b8'] },
                        }));
                      }}
                      className="text-[11px] text-[#8a3a46] font-bold hover:underline"
                    >
                      + لون علم إضافي
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(config.colors?.flags?.length ? config.colors.flags : currentThemeBase.flags).map((col, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-1 rounded-lg border bg-white p-1">
                        <input
                          type="color"
                          value={col}
                          onChange={(e) => {
                            const curFlags = [...(config.colors?.flags?.length ? config.colors.flags : currentThemeBase.flags)];
                            curFlags[fIdx] = e.target.value;
                            setConfig((prev) => ({ ...prev, colors: { ...prev.colors, flags: curFlags } }));
                          }}
                          className="h-6 w-6 rounded cursor-pointer border-0"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const curFlags = (config.colors?.flags?.length ? config.colors.flags : currentThemeBase.flags).filter((_, idx) => idx !== fIdx);
                            if (curFlags.length < 2) return;
                            setConfig((prev) => ({ ...prev, colors: { ...prev.colors, flags: curFlags } }));
                          }}
                          className="text-muted-foreground hover:text-red-500 text-xs px-1"
                          title="حذف هذا اللون"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setConfig((prev) => ({
                ...prev,
                theme: 'rose',
                colors: { bg: null, fg: null, hi: null, rope: null, stem: null, flags: [] },
              }));
              setCustomColorsOpen(false);
            }}
            className="w-full rounded-full text-xs font-bold"
          >
            رجّع للثيم الافتراضي 🌸
          </Button>
        </div>

        {/* Group C: التوقيت والحركة (Timing & Animation) */}
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6 space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-base font-black flex items-center gap-2">
              <Sliders className="h-4 w-4 text-[#8a3a46]" />
              التوقيت وحركة الانتقال
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              مدة بقاء الرسالة، سرعة الانزلاق، ونوع التأثير البصري.
            </p>
          </div>

          {/* Interval Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span>مدة ظهور الرسالة (Interval):</span>
              <span className="font-mono text-[#8a3a46] font-extrabold">
                {config.intervalMs === 0 ? 'ثابتة (بدون تبديل)' : `${(config.intervalMs / 1000).toFixed(1)} ثوانٍ`}
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={15000}
              step={500}
              value={config.intervalMs === 0 ? 5000 : config.intervalMs}
              onChange={(e) => setConfig((prev) => ({ ...prev, intervalMs: Number(e.target.value) }))}
              disabled={config.intervalMs === 0}
              className="w-full accent-[#8a3a46]"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>2 ثوانٍ</span>
              <label className="flex items-center gap-1 font-bold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.intervalMs === 0}
                  onChange={(e) => setConfig((prev) => ({ ...prev, intervalMs: e.target.checked ? 0 : 5000 }))}
                  className="rounded accent-[#8a3a46]"
                />
                <span>تثبيت بدون تبديل تلقائي</span>
              </label>
              <span>15 ثانية</span>
            </div>
          </div>

          {/* Transition Duration Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span>سرعة الانتقال بين الرسائل:</span>
              <span className="font-mono text-[#8a3a46] font-extrabold">
                {(config.transitionMs / 1000).toFixed(2)} ثانية ({config.transitionMs}ms)
              </span>
            </div>
            <input
              type="range"
              min={150}
              max={2000}
              step={50}
              value={config.transitionMs}
              onChange={(e) => setConfig((prev) => ({ ...prev, transitionMs: Number(e.target.value) }))}
              className="w-full accent-[#8a3a46]"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>0.15 ثانية (سريع جدًا)</span>
              <span>2 ثانية (ناعم وبطيء)</span>
            </div>
          </div>

          {/* Transition Effect (Slide / Fade) */}
          <div>
            <label className="text-xs font-bold block mb-2">نوع الانتقال:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, effect: 'slide' }))}
                className={`rounded-2xl border py-2.5 px-3 text-xs font-bold transition-all ${
                  config.effect === 'slide'
                    ? 'border-[#8a3a46] bg-[#8a3a46] text-white shadow-sm'
                    : 'border-border bg-secondary/30 text-foreground hover:bg-secondary'
                }`}
              >
                انزلاق ربيعي (Slide) 🌸
              </button>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, effect: 'fade' }))}
                className={`rounded-2xl border py-2.5 px-3 text-xs font-bold transition-all ${
                  config.effect === 'fade'
                    ? 'border-[#8a3a46] bg-[#8a3a46] text-white shadow-sm'
                    : 'border-border bg-secondary/30 text-foreground hover:bg-secondary'
                }`}
              >
                تلاشي ناعم (Fade) ✨
              </button>
            </div>
          </div>
        </div>

        {/* Group D: الزخارف والسلوك (Decorations & Behavior) */}
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-6 space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-base font-black flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#8a3a46]" />
              الزخارف وسلوك العرض
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              التحكم في ظهور الأعلام والزهور، خيارات الإغلاق، والصفحات المستهدفة.
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border p-3 bg-secondary/10">
              <div>
                <span className="text-xs font-bold block">شريط الأعلام المعلقة (Flags)</span>
                <span className="text-[11px] text-muted-foreground">أعلام ملونة تتمايل مع حركة الهواء أسفل الشريط</span>
              </div>
              <Switch
                checked={config.flags}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, flags: checked }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border p-3 bg-secondary/10">
              <div>
                <span className="text-xs font-bold block">الزهور الجانبية النامية (Flowers)</span>
                <span className="text-[11px] text-muted-foreground">زهور برية تنبت وتتمايل على أطراف الشريط</span>
              </div>
              <Switch
                checked={config.flowers}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, flowers: checked }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border p-3 bg-secondary/10">
              <div>
                <span className="text-xs font-bold block">زر إغلاق الشريط (Dismissible)</span>
                <span className="text-[11px] text-muted-foreground">إتاحة زر X للعميلة لإخفاء الشريط إذا أرادت</span>
              </div>
              <Switch
                checked={config.dismissible}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, dismissible: checked }))}
              />
            </div>
          </div>

          {/* Dismiss TTL Options */}
          {config.dismissible && (
            <div className="rounded-2xl border border-border/80 bg-secondary/15 p-3.5 space-y-2">
              <label className="text-xs font-bold block">تذكّر إغلاق الشريط (Remember Dismiss):</label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {[
                  { value: 0, label: 'لنهاية الجلسة' },
                  { value: 24, label: 'لمدة 24 ساعة' },
                  { value: 168, label: 'لمدة 7 أيام' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, dismissTtlHours: opt.value }))}
                    className={`rounded-xl border py-2 text-center font-bold transition-all ${
                      config.dismissTtlHours === opt.value
                        ? 'border-[#8a3a46] bg-[#8a3a46] text-white shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Show on Pages */}
          <div className="space-y-2">
            <label className="text-xs font-bold block">إظهار الشريط على الصفحات:</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, showOn: ['*'] }))}
                className={`rounded-xl border py-2.5 px-3 font-bold transition-all ${
                  config.showOn.includes('*')
                    ? 'border-[#8a3a46] bg-[#8a3a46] text-white shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                كل صفحات المتجر
              </button>
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, showOn: ['/'] }))}
                className={`rounded-xl border py-2.5 px-3 font-bold transition-all ${
                  config.showOn.length === 1 && config.showOn[0] === '/'
                    ? 'border-[#8a3a46] bg-[#8a3a46] text-white shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                الصفحة الرئيسية فقط
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnnounceSection;
