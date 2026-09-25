"use client";

// LUBNÉL full product editor — one shared form powering BOTH the dashboard's
// products section and the AI result cards (تعديل المنتج من نتيجة AI).
// Complete owner control: identity, pricing, images (upload / remove /
// make-main), stock, badge, variants, publishing — no more window.prompt.
import { useRef, useState } from "react";
import { Check, Eye, EyeOff, Loader2, Plus, Sparkles, Star, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/lubnel-helpers";
import { CATEGORY_LABELS_AR, type Product } from "@/lib/lubnel-types";
import { useAdminAr, useAdminT } from "@/lib/admin-i18n";

const PLACEHOLDER_IMAGE = "/images/p-beauty-box.webp";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "فشل الطلب");
  return data as T;
}

export function ProductFormModal({ product, onClose, onSaved, eyebrow, title }: {
  product: Product;
  onClose: () => void;
  onSaved: (saved: Product) => void;
  eyebrow?: string;
  title?: string;
}) {
  const t = useAdminT();
  const ar = useAdminAr();
  const [form, setForm] = useState({
    nameAr: product.nameAr || "", name: product.name || "", category: product.category || "Makeup",
    price: String(product.price ?? ""), oldPrice: product.oldPrice ? String(product.oldPrice) : "",
    stock: String(product.stock ?? 0), description: product.description || "",
    badgeAr: product.badgeAr || "", visible: product.visible !== false, featured: !!product.featured,
  });
  const [images, setImages] = useState<string[]>(
    (product.images?.length ? product.images : product.image ? [product.image] : []).filter(Boolean),
  );
  const [variants, setVariants] = useState<{ label: string; value: string; image?: string }[]>(
    (product.variants || []).map(v => ({ label: v.label, value: v.value, image: (v as { image?: string }).image })),
  );
  const pickingVariant = useRef<number | null>(null);
  const variantFileInput = useRef<HTMLInputElement>(null);

  // U85-VARIANTS — every option (الريحة/اللون) carries its own photo: the
  // customer taps the option and its photo becomes the product image.
  const uploadVariantImage = async (index: number, file: File) => {
    if (!file.type.startsWith("image/")) return toast.error(t("اختاري صورة صالحة"));
    try {
      const compressed = await compressImage(file, 1200, 0.82);
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("altText", `${form.nameAr || form.name} — ${variants[index]?.value || ""}`);
      const res = await api<{ url: string }>("/api/admin/media", { method: "POST", body: fd });
      setVariants(current => current.map((item, i) => (i === index ? { ...item, image: res.url } : item)));
      toast.success(t("تم رفع صورة النوع ✓"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("فشل رفع صورة النوع"));
    }
  };
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof form>) => setForm(current => ({ ...current, ...patch }));

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!list.length) return toast.error(t("اختاري صورًا صالحة (JPG, PNG, WEBP)"));
    const room = 5 - images.length;
    if (room <= 0) return toast.error(t("الحد الأقصى 5 صور للمنتج"));
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of list.slice(0, room)) {
        const compressed = await compressImage(file, 1600, 0.82);
        const fd = new FormData();
        fd.append("file", compressed);
        fd.append("altText", form.nameAr || form.name || product.id);
        const res = await api<{ url: string }>("/api/admin/media", { method: "POST", body: fd });
        urls.push(res.url);
      }
      setImages(prev => [...prev, ...urls]);
      toast.success(t("تم رفع الصورة"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("فشل رفع الصورة"));
    } finally {
      setUploading(false);
    }
  };
  const removeImage = (url: string) => setImages(prev => prev.filter(u => u !== url));
  const makeMain = (url: string) => setImages(prev => [url, ...prev.filter(u => u !== url)]);

  const save = async () => {
    const price = Number(form.price);
    if (!form.nameAr.trim() || !form.name.trim() || !form.category || !Number.isFinite(price) || price < 0) {
      return toast.error(t("الاسم والقسم وسعر صحيح مطلوبة"));
    }
    setSaving(true);
    try {
      const saved: Product = await api("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: product.id, name: form.name.trim(), nameAr: form.nameAr.trim(),
          category: form.category, categoryAr: CATEGORY_LABELS_AR[form.category] || form.category,
          price: Math.floor(price),
          oldPrice: form.oldPrice ? Math.floor(Number(form.oldPrice)) : null,
          description: form.description,
          images: images.length ? images : [PLACEHOLDER_IMAGE],
          variants, stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
          featured: form.featured, visible: form.visible,
          badgeAr: form.badgeAr || null, badge: form.badgeAr || null,
        }),
      });
      toast.success(t("تم حفظ تعديلات المنتج ونشرها في المتجر"));
      onSaved({ ...saved, id: product.id });
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("تعذر الحفظ")); }
    finally { setSaving(false); }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title || t("تعديل المنتج")}>
      <div className="admin-modal ai-edit-modal">
        <div className="modal-head">
          <div><span className="eyebrow">{eyebrow || "PRODUCT / FULL EDIT"}</span><h2>{title || t("تعديل المنتج — تحكم كامل")}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label={t("إغلاق")}><X size={19} /></button>
        </div>

        <div
          className={`upload-drop ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
          onClick={() => !uploading && fileInput.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (!uploading) void uploadFiles(e.dataTransfer.files); }}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.current?.click(); } }}
          aria-label={t("رفع صور المنتج")}
        >
          <Upload size={22} className={uploading ? "spin" : ""} />
          <strong>{uploading ? t("جارٍ الرفع...") : dragOver ? t("أفلتي الصور هنا") : t("أضيفي أو اسحبي صورًا — حتى 5 صور")}</strong>
          <span>{t("أول صورة هي الرئيسية في المتجر")}</span>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden
            onChange={e => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {images.length > 0 && (
          <div className="upload-thumbs" role="list" aria-label={t("صور المنتج")}>
            {images.map((url, i) => (
              <div className={`upload-thumb ${i === 0 ? "is-main" : ""}`} key={url} role="listitem">
                <img src={url} alt={`${t("صورة")} ${i + 1}`} loading="lazy" decoding="async" />
                {i === 0 ? <em>{t("رئيسية")}</em> : (
                  <button type="button" className="thumb-main" title={t("اجعليها الرئيسية")} onClick={() => makeMain(url)}><Star size={12} /></button>
                )}
                <button type="button" onClick={() => removeImage(url)} aria-label={t("حذف الصورة")}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="ai-edit-grid">
          <label>{t("الاسم بالعربية")}<input value={form.nameAr} onChange={e => set({ nameAr: e.target.value })} /></label>
          <label>{t("الاسم بالإنجليزية")}<input value={form.name} onChange={e => set({ name: e.target.value })} dir="ltr" /></label>
          <label>{t("القسم")}
            <select value={form.category} onChange={e => set({ category: e.target.value })}>
              {Object.entries(CATEGORY_LABELS_AR).map(([en, arLabel]) => <option key={en} value={en}>{ar ? arLabel : en}</option>)}
            </select>
          </label>
          <label>{t("الشارة العربية")}<input value={form.badgeAr} onChange={e => set({ badgeAr: e.target.value })} placeholder={t("جديد / الأكثر مبيعًا…")} /></label>
          <label>{t("السعر (ج.م)")}<input type="number" min={0} value={form.price} onChange={e => set({ price: e.target.value })} /></label>
          <label>{t("السعر قبل الخصم")}<input type="number" min={0} value={form.oldPrice} onChange={e => set({ oldPrice: e.target.value })} placeholder={t("اتركيه فارغًا إن لا يوجد")} /></label>
          <label>{t("المخزون")}<input type="number" min={0} value={form.stock} onChange={e => set({ stock: e.target.value })} /></label>
          <label className="wide">{t("الوصف")}<textarea rows={3} value={form.description} onChange={e => set({ description: e.target.value })} /></label>

          <div className="wide">
            <span className="variants-label">{t("الأنواع (الريحة، اللون…) — لكل نوع صورته")}</span>
            {variants.map((v, i) => (
              <div className="variant-row flex items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-2" key={i}>
                <label
                  className="relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground"
                  title={t("اختاري صورة النوع")}
                >
                  {v.image ? <img src={v.image} alt={v.value || v.label} className="h-full w-full object-cover" loading="lazy" /> : <Upload size={14} />}
                  <input type="file" accept="image/*" hidden
                    onChange={e => { const f = e.target.files?.[0]; if (f) void uploadVariantImage(i, f); e.target.value = ""; }} />
                </label>
                <input value={v.label} placeholder={t("النوع — مثال: الريحة / اللون")} onChange={e => setVariants(current => current.map((item, index) => index === i ? { ...item, label: e.target.value } : item))} />
                <input value={v.value} placeholder={t("القيمة — مثال: تفاح")} onChange={e => setVariants(current => current.map((item, index) => index === i ? { ...item, value: e.target.value } : item))} />
                <button type="button" className="icon-button" aria-label={t("حذف المتغير")} onClick={() => setVariants(current => current.filter((_, index) => index !== i))}><X size={14} /></button>
              </div>
            ))}
            <button type="button" className="button button-outline small-add" onClick={() => setVariants(current => [...current, { label: "", value: "" }])}>
              <Plus size={13} /> {t("إضافة نوع")}
            </button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("اضيفي نوعًا لكل ريحة أو لون مع صورته — الزبونة تختار النوع في صفحة المنتج وتظهر صورته في السلة والطلب.")}
            </p>
          </div>

          <div className="ai-edit-toggles wide">
            <button className={form.visible ? "on" : ""} onClick={() => set({ visible: !form.visible })} aria-pressed={form.visible}>
              {form.visible ? <Eye size={14} /> : <EyeOff size={14} />} {form.visible ? t("منشور في المتجر") : t("مخفي")}
            </button>
            <button className={form.featured ? "on gold" : ""} onClick={() => set({ featured: !form.featured })} aria-pressed={form.featured}>
              <Sparkles size={14} /> {form.featured ? t("مميّز في الرئيسية") : t("غير مميّز")}
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose}>{t("إلغاء")}</button>
          <button className="button button-dark" onClick={() => void save()} disabled={saving || uploading}>
            {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />} {t("حفظ ونشر")}
          </button>
        </div>
      </div>
    </div>
  );
}
