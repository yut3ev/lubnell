'use client';

// SUP-8 — Studio section «النصوص والفوتر»: full control over every storefront
// copy the owner asked for — tagline, footer blurb, footer links (add/remove),
// contact details, social URLs, copyright line — stored under StoreSettings
// key "texts" and consumed live by the storefront layout.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { apiJson } from '../helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { SiteTexts } from '@/lib/site-texts';

export default function ContentSection() {
  const [form, setForm] = useState<SiteTexts | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; settings: SiteTexts | null }>('/api/admin/settings?key=texts');
    if (ok && data?.ok) setForm(data.settings || {});
    else setForm({});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ key: 'texts', ...form }),
    });
    setSaving(false);
    if (ok && data?.ok) toast({ title: 'تم حفظ النصوص — ستظهر في المتجر فورًا ✓' });
    else toast({ title: data?.error || 'تعذر الحفظ', variant: 'destructive' });
  }

  if (!form) return <p className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</p>;

  const set = (patch: Partial<SiteTexts>) => setForm({ ...form, ...patch });
  const field = 'grid gap-1.5';
  const card = 'grid gap-4 rounded-2xl border border-border/60 bg-card p-5';

  const links = form.footerLinks || [];
  function setLink(i: number, patch: Partial<{ href: string; labelAr: string; labelEn: string }>) {
    const next = links.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    set({ footerLinks: next });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        تحكّمي في كل نصوص الموقع: الوصف التعريفي، الفوتر بالكامل (الروابط، بيانات التواصل، السوشيال، الحقوق)، وشريط الإعلان.
        اتركي أي حقل فارغًا ليُستخدم النص الافتراضي. التغييرات تُطبَّق على المتجر فورًا بعد الحفظ.
      </p>

      {/* brand & announcement */}
      <div className={card}>
        <h3 className="text-sm font-black">التعريف والإعلان</h3>
        <div className={field}>
          <Label>الوصف التعريفي (عربي)</Label>
          <Input value={form.taglineAr || ''} onChange={(e) => set({ taglineAr: e.target.value })} placeholder="جمالٌ يُهدى بكل حب" />
        </div>
        <div className={field}>
          <Label>الوصف التعريفي (إنجليزي)</Label>
          <Input dir="ltr" className="text-left" value={form.taglineEn || ''} onChange={(e) => set({ taglineEn: e.target.value })} placeholder="Beauty, gifted with love" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>شريط الإعلان (عربي)</Label>
            <Input value={form.announcementAr || ''} onChange={(e) => set({ announcementAr: e.target.value })} placeholder="شحن مجاني للطلبات فوق ٩٠٠ ج.م" />
          </div>
          <div className={field}>
            <Label>شريط الإعلان (إنجليزي)</Label>
            <Input dir="ltr" className="text-left" value={form.announcementEn || ''} onChange={(e) => set({ announcementEn: e.target.value })} placeholder="Free shipping over 900 EGP" />
          </div>
        </div>
      </div>

      {/* footer blurb */}
      <div className={card}>
        <h3 className="text-sm font-black">نص الفوتر التعريفي</h3>
        <div className={field}>
          <Label>نبذة الفوتر (عربي)</Label>
          <textarea
            rows={2}
            value={form.footerBlurbAr || ''}
            onChange={(e) => set({ footerBlurbAr: e.target.value })}
            className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="طقس جمالك، بصياغة مصرية معاصرة…"
          />
        </div>
        <div className={field}>
          <Label>نبذة الفوتر (إنجليزي)</Label>
          <textarea
            rows={2}
            dir="ltr"
            className="resize-none rounded-md border border-input bg-background px-3 py-2 text-left text-sm"
            value={form.footerBlurbEn || ''}
            onChange={(e) => set({ footerBlurbEn: e.target.value })}
            placeholder="Your beauty ritual, reimagined in Cairo…"
          />
        </div>
      </div>

      {/* footer links */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black">روابط الفوتر</h3>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5"
            onClick={() => set({ footerLinks: [...links, { href: '/#catalog', labelAr: '', labelEn: '' }] })}
          >
            <Plus className="h-3.5 w-3.5" /> رابط جديد
          </Button>
        </div>
        <div className="grid gap-3">
          {links.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-border/50 bg-secondary/20 p-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
              <div className={field}>
                <Label className="text-[11px]">النص (عربي)</Label>
                <Input value={l.labelAr} onChange={(e) => setLink(i, { labelAr: e.target.value })} />
              </div>
              <div className={field}>
                <Label className="text-[11px]">النص (إنجليزي)</Label>
                <Input dir="ltr" className="text-left" value={l.labelEn} onChange={(e) => setLink(i, { labelEn: e.target.value })} />
              </div>
              <div className={field}>
                <Label className="text-[11px]">الرابط</Label>
                <Input dir="ltr" className="text-left" value={l.href} onChange={(e) => setLink(i, { href: e.target.value })} placeholder="/c/makeup" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => set({ footerLinks: links.filter((_, idx) => idx !== i) })}
                aria-label="حذف الرابط"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {links.length === 0 && <p className="text-xs text-muted-foreground">لا روابط — ستُستخدم الروابط الافتراضية.</p>}
        </div>
      </div>

      {/* contact & socials */}
      <div className={card}>
        <h3 className="text-sm font-black">التواصل والسوشيال</h3>
        <div className={field}>
          <Label>البريد الإلكتروني</Label>
          <Input dir="ltr" className="text-left" value={form.contactEmail || ''} onChange={(e) => set({ contactEmail: e.target.value })} placeholder="hello@lubnel.com" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>مواعيد العمل (عربي)</Label>
            <Input value={form.hoursAr || ''} onChange={(e) => set({ hoursAr: e.target.value })} />
          </div>
          <div className={field}>
            <Label>مواعيد العمل (إنجليزي)</Label>
            <Input dir="ltr" className="text-left" value={form.hoursEn || ''} onChange={(e) => set({ hoursEn: e.target.value })} />
          </div>
          <div className={field}>
            <Label>الموقع (عربي)</Label>
            <Input value={form.locationAr || ''} onChange={(e) => set({ locationAr: e.target.value })} placeholder="القاهرة، مصر" />
          </div>
          <div className={field}>
            <Label>الموقع (إنجليزي)</Label>
            <Input dir="ltr" className="text-left" value={form.locationEn || ''} onChange={(e) => set({ locationEn: e.target.value })} placeholder="Cairo, Egypt" />
          </div>
          <div className={field}>
            <Label>رابط إنستجرام</Label>
            <Input dir="ltr" className="text-left" value={form.instagramUrl || ''} onChange={(e) => set({ instagramUrl: e.target.value })} placeholder="https://instagram.com/…" />
          </div>
          <div className={field}>
            <Label>رابط فيسبوك</Label>
            <Input dir="ltr" className="text-left" value={form.facebookUrl || ''} onChange={(e) => set({ facebookUrl: e.target.value })} placeholder="https://facebook.com/…" />
          </div>
          {/* U52-CONTACT-SOCIAL — قناة واتساب + تيك توك (صفحة التواصل) */}
          <div className={field}>
            <Label>رابط قناة الواتساب</Label>
            <Input dir="ltr" className="text-left" value={form.whatsappChannelUrl || ''} onChange={(e) => set({ whatsappChannelUrl: e.target.value })} placeholder="https://whatsapp.com/channel/…" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">يظهر في صفحة «تواصلي معنا» — لو لسه مضيفاش القناة هيفضل مفتوح على واتساب المتجر مؤقتًا.</p>
          </div>
          <div className={field}>
            <Label>رابط تيك توك</Label>
            <Input dir="ltr" className="text-left" value={form.tiktokUrl || ''} onChange={(e) => set({ tiktokUrl: e.target.value })} placeholder="https://tiktok.com/@lubnel" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">يظهر في صفحة «تواصلي معنا» — اكتبي رابط حسابك هنا وقت ما يكون جاهز.</p>
          </div>
          {/* U67-YOUTUBE-SOCIAL — قناة يوتيوب (صفحة التواصل + الفوتر) */}
          <div className={field}>
            <Label>رابط قناة يوتيوب</Label>
            <Input dir="ltr" className="text-left" value={form.youtubeUrl || ''} onChange={(e) => set({ youtubeUrl: e.target.value })} placeholder="https://youtube.com/@lubnel9606" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">يظهر في قسم «تابعينا على» وفوتر المتجر بأيقونة متحركة — بتفتح القناة في تاب جديد.</p>
          </div>
        </div>
      </div>

      {/* bottom bar */}
      <div className={card}>
        <h3 className="text-sm font-black">سطر الحقوق والخاتمة</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <Label>حقوق النشر (عربي)</Label>
            <Input value={form.copyrightAr || ''} onChange={(e) => set({ copyrightAr: e.target.value })} />
          </div>
          <div className={field}>
            <Label>حقوق النشر (إنجليزي)</Label>
            <Input dir="ltr" className="text-left" value={form.copyrightEn || ''} onChange={(e) => set({ copyrightEn: e.target.value })} />
          </div>
          <div className={field}>
            <Label>سطر الخاتمة (عربي)</Label>
            <Input value={form.madeWithAr || ''} onChange={(e) => set({ madeWithAr: e.target.value })} />
          </div>
          <div className={field}>
            <Label>سطر الخاتمة (إنجليزي)</Label>
            <Input dir="ltr" className="text-left" value={form.madeWithEn || ''} onChange={(e) => set({ madeWithEn: e.target.value })} />
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/25">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <><Save className="ml-1 h-4 w-4" aria-hidden /> حفظ كل النصوص</>}
      </Button>
    </div>
  );
}
