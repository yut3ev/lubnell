"use client";

// LUBNÉL AI Admin Agent — chat UI with direct execution mode (owner powers),
// editable result cards (تعديل المنتج from the AI result), and Gemini settings.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera, Check, ExternalLink, Eye, EyeOff, Layers, Loader2, MapPin, Package, Pencil, Phone, Send, Settings2,
  Sparkles, Upload, Wand2, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/lubnel-helpers";
import { CATEGORY_LABELS_AR, type Product } from "@/lib/lubnel-types";
import { ProductFormModal } from "@/components/lubnel/admin/product-form-modal";
import { useAdminAr, useAdminDateLocale, useAdminMoney, useAdminT } from "@/lib/admin-i18n";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "فشل الطلب");
  return data as T;
}
const post = (url: string, body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export type AiProductRef = {
  slug: string; name: string; nameAr: string; category: string; categoryAr: string;
  price: number; oldPrice: number | null; stock: number; visible: boolean; featured: boolean; image: string;
};
export type AiOrderRef = {
  orderNumber: string; customerName: string; customerPhone: string; customerAddress: string | null;
  total: number; status: string; statusAr: string; itemCount: number; itemsSummary: string;
  couponCode: string | null; cancelRequested: boolean; createdAt: string;
};
export type AiOrderItem = { nameAr: string; name: string; qty: number; price: number; lineTotal: number };
export type AiOrderDetail = AiOrderRef & {
  items: AiOrderItem[]; subtotal: number; shipping: number; discount: number;
  device: string | null; cancelRequestedAt: string | null; updatedAt: string;
};
export type AiExecutedAction = {
  tool: string; ok: boolean; summary: string; dryRun?: boolean; error?: string;
  product?: AiProductRef; products?: AiProductRef[]; orders?: AiOrderRef[]; orderDetail?: AiOrderDetail; orderNumber?: string;
  needsConfirm?: boolean; bulkCount?: number; bulkNames?: string[];
};
type AgentResponse = { reply: string; executed: AiExecutedAction[]; provider: "gemini" | "zai"; mode: "execute" | "plan"; canExecute: boolean };
type ChatImage = { url: string; mimeType: string; name: string };
type ChatMessage = {
  from: "user" | "ai"; text: string; images?: ChatImage[];
  executed?: AiExecutedAction[]; provider?: string; mode?: string; userRequest?: string; failed?: boolean;
};
type AiSettingsInfo = { provider: "zai" | "gemini"; geminiModel: string; hasKey: boolean; keyTail: string; fromEnv?: boolean };

const TOOL_LABELS: Record<string, string> = {
  get_catalog: "بحث في المنتجات",
  add_product: "إضافة منتج",
  update_product: "تعديل منتج",
  delete_product: "حذف منتج",
  add_category: "إنشاء قسم",
  add_coupon: "إنشاء كوبون",
  update_order_status: "تحديث حالة طلب",
  get_stats: "إحصائيات المتجر",
  get_orders: "البحث في الطلبات",
  get_order_details: "تفاصيل الطلب",
  bulk_update_products: "تعديل جماعي",
};

const QUICK_ACTIONS = [
  "أضيفي منتج: اسم المنتج … — القسم … — السعر …",
  "عدّلي سعر … إلى … جنيه",
  "خفي منتج … / انشري منتج …",
  "فين طلبات الرقم 01…؟",
  "افتحي تفاصيل الطلب الأخير",
  "إيه حالة المتجر النهارده؟",
  "اعملي كوبون خصم 15٪ لمدة 3 أيام بكود …",
  "غيّري حالة الطلب … إلى تم الشحن",
  "خفي كل المنتجات تحت 90 جنيه",
];

const ORDER_STATUS_STYLES: Record<string, string> = {
  new: "st-new", confirmed: "st-confirmed", preparing: "st-preparing",
  shipped: "st-shipped", completed: "st-completed", cancelled: "st-cancelled",
};

export function AISection({ products, onCreated, isOwner, canExecute }: {
  products: Product[]; onCreated: () => void; isOwner: boolean; canExecute: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    from: "ai",
    text: canExecute
      ? "أهلًا بكِ ✦ أنا وكيلة LUBNÉL الذكية. أوصيكِ بأي شيء وسأنفذه فورًا على المتجر: «أضيفي روج نيود بسعر 90 في قسم شفايف»، «عدّلي سعر بوكس الجامعة إلى 180»، «إيه مبيعات النهارده؟» — وارفعي صورة المنتج وأنا أرفعها معاه."
      : "أهلًا بكِ ✦ أنا مساعدة LUBNÉL. سأجهّز لكِ معاينة دقيقة لأي طلب إداري — والتنفيذ المباشر متاح للمالكة.",
  }]);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ChatImage[]>([]);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"execute" | "plan">(canExecute ? "execute" : "plan");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const t = useAdminT();
  const ar = useAdminAr();
  const dateLocale = useAdminDateLocale();
  const moneyFmt = useAdminMoney();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const patchProductInMessages = useCallback((slug: string, ref: Partial<AiProductRef>) => {
    setMessages(current => current.map(m => {
      if (!m.executed) return m;
      // R160 — patches land in BOTH shapes: the single executed-action card
      // and every card inside a get_catalog results stack.
      return {
        ...m,
        executed: m.executed.map(a => ({
          ...a,
          product: a.product && a.product.slug === slug ? { ...a.product, ...ref } : a.product,
          products: a.products?.length ? a.products.map(p => (p.slug === slug ? { ...p, ...ref } : p)) : a.products,
        })),
      };
    }));
  }, []);

  const send = async (raw?: string, forceMode?: "execute" | "plan") => {
    const text = (raw !== undefined ? raw : message).trim();
    if ((!text && !attachments.length) || pending) return;
    const request = text || "حللي صور المنتج المرفقة وجهزي كل البيانات.";
    const imageSnapshot = [...attachments];
    const usedMode = forceMode || mode;
    setMessages(current => [...current, { from: "user", text: request, images: imageSnapshot }]);
    setMessage("");
    setAttachments([]);
    setPending(true);
    const history = messages
      .filter(m => m.text && !m.failed)
      .slice(-8)
      .map(m => ({ role: m.from, text: m.text.slice(0, 600) }));
    try {
      const res = await api<AgentResponse>("/api/admin/ai", post("/api/admin/ai", {
        message: request,
        images: imageSnapshot.map(i => ({ url: i.url, mimeType: i.mimeType, name: i.name })),
        history,
        mode: usedMode,
      }));
      setMessages(current => [...current, {
        from: "ai", text: res.reply, executed: res.executed, provider: res.provider, mode: res.mode, userRequest: request,
      }]);
      if (res.executed.some(e => e.ok && !e.dryRun)) onCreated();
    } catch (e) {
      setMessages(current => [...current, { from: "ai", text: e instanceof Error ? e.message : "تعذر تنفيذ الطلب الآن", failed: true }]);
    } finally {
      setPending(false);
    }
  };

  const toggleVisibility = async (ref: AiProductRef) => {
    const full = products.find(p => p.id === ref.slug);
    const payload = {
      slug: ref.slug, name: full?.name || ref.name, nameAr: full?.nameAr || ref.nameAr,
      category: full?.category || ref.category, categoryAr: full?.categoryAr || ref.categoryAr,
      price: full?.price ?? ref.price, oldPrice: full?.oldPrice ?? ref.oldPrice ?? null,
      description: full?.description || "", images: full?.images?.length ? full.images : [ref.image],
      variants: full?.variants || [], stock: full?.stock ?? ref.stock,
      featured: full?.featured ?? ref.featured, visible: !ref.visible,
      badge: full?.badge ?? null, badgeAr: full?.badgeAr ?? null,
    };
    try {
      await api("/api/admin/products", post("/api/admin/products", payload));
      patchProductInMessages(ref.slug, { visible: !ref.visible });
      toast.success(!ref.visible ? ar ? `تم نشر «${ref.nameAr}» في المتجر` : `“${ref.name}” published to the store` : ar ? `تم إخفاء «${ref.nameAr}»` : `“${ref.name}” hidden`);
      onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("تعذر التغيير")); }
  };

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.readAsDataURL(file);
  });
  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, 5 - attachments.length);
    for (const file of selected) {
      if (!file.type.startsWith("image/")) { toast.error(t("اختاري صورًا صالحة")); continue; }
      if (file.size > 8_000_000) { toast.error(t("اختاري صورًا أقل من 8MB")); continue; }
      try {
        const compressed = await compressImage(file, 1024, 0.8);
        const url = await fileToDataUrl(compressed);
        setAttachments(current => [...current, { url, mimeType: compressed.type || file.type, name: file.name }]);
      } catch { toast.error(t("تعذر إضافة الصورة")); }
    }
  };

  const editingProduct = editingSlug ? products.find(p => p.id === editingSlug) || null : null;
  const lastProvider = [...messages].reverse().find(m => m.provider)?.provider;

  return (
    <div className="admin-content ai-page">
      <div className="ai-head">
        <div>
          <div className="ai-kicker"><span>✦</span> LUBNÉL AI / STORE AGENT</div>
          <h2>{t("وكيلتكِ الذكية في كل تفصيلة.")}</h2>
          <p>{t("أوامر بالعربية تُنفَّذ فورًا: منتجات، أسعار، مخزون، كوبونات، طلبات — كل شيء مسجّل في سجل التدقيق.")}</p>
        </div>
        <div className="ai-head-tools">
          <span className={`ai-provider-chip ${lastProvider || ""}`}>
            <Sparkles size={12} />
            {lastProvider === "gemini" ? "Gemini" : lastProvider === "zai" ? t("المساعد الداخلي") : t("جاهزة")}
          </span>
          {isOwner && (
            <button className={`icon-button ${showSettings ? "active" : ""}`} title={t("إعدادات الذكاء الاصطناعي")} onClick={() => setShowSettings(s => !s)}>
              <Settings2 size={17} />
            </button>
          )}
        </div>
      </div>

      {isOwner && showSettings && <AiSettingsPanel />}

      <div className="ai-mode-row">
        {canExecute ? (
          <div className="ai-mode-toggle" role="tablist" aria-label={t("وضع التنفيذ")}>
            <button role="tab" aria-selected={mode === "execute"} className={mode === "execute" ? "active" : ""} onClick={() => setMode("execute")}>
              <Zap size={13} /> {t("تنفيذ مباشر")}
            </button>
            <button role="tab" aria-selected={mode === "plan"} className={mode === "plan" ? "active" : ""} onClick={() => setMode("plan")}>
              <Wand2 size={13} /> {t("معاينة قبل التنفيذ")}
            </button>
          </div>
        ) : (
          <span className="ai-plan-only">{t("وضع المعاينة فقط — التنفيذ المباشر يحتاج صلاحية ai.execute")}</span>
        )}
        <span className="ai-mode-hint">
          {mode === "execute" ? t("الأوامر تُنفَّذ فورًا على المتجر الحقيقي") : t("لن يتغير شيء — سأعرض لكِ الخطة أولًا")}
        </span>
      </div>

      <div className="quick-actions">
        <span>{t("أوامر جاهزة")}</span>
        {QUICK_ACTIONS.map(action => <button key={action} onClick={() => setMessage(action)} title={t(action)}>{t(action).slice(0, 24)}…</button>)}
      </div>

      <div className="ai-chat">
        <div className="chat-messages">
          {messages.map((item, i) => (
            <div className={`chat-bubble ${item.from}`} key={i}>
              <div className="bubble-avatar">{item.from === "ai" ? "✦" : ar ? "م" : "U"}</div>
              <div>
                <p>{item.text}</p>
                {item.images?.length ? (
                  <div className="ai-image-strip">{item.images.map(image => <img key={image.name + image.url.slice(-8)} src={image.url} alt={image.name} />)}</div>
                ) : null}
                {item.executed && item.executed.length > 0 && (
                  <div className="ai-tool-trace">
                    {item.executed.map((action, index) => (
                      <span key={index} className={`ai-tool-chip ${action.ok ? (action.dryRun ? "dry" : "ok") : "err"}`}>
                        {action.ok ? (action.dryRun ? "◇" : "✓") : "✕"} {t(TOOL_LABELS[action.tool] || action.tool)}
                      </span>
                    ))}
                  </div>
                )}
                {item.executed?.map((action, index) => {
                  // R160 — a get_catalog result now renders EVERY match as a
                  // fully editable card (تعديل المنتج straight from the AI
                  // result), not just the first one as a lone text reply.
                  if (action.products?.length) {
                    return (
                      <div className="ai-catalog-stack" key={`c${index}`}>
                        <div className="ai-catalog-head"><Layers size={14} /> {t("نتائج الكتالوج")} — {action.products.length} {t("منتج")}</div>
                        <div className="ai-catalog-grid">
                          {action.products.map(ref => (
                            <AiProductCard key={ref.slug} product={ref} onEdit={() => setEditingSlug(ref.slug)} onToggle={() => void toggleVisibility(ref)} />
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (action.product && action.tool !== "delete_product") {
                    return (
                      <AiProductCard key={`c${index}`} product={action.product} onEdit={() => setEditingSlug(action.product!.slug)} onToggle={() => void toggleVisibility(action.product!)} />
                    );
                  }
                  if (action.orderDetail) {
                    const detail = action.orderDetail;
                    return (
                      <div className="ai-order-card detail" key={`c${index}`}>
                        <div className="ai-order-head">
                          <span className="ai-order-num"><Package size={13} /> {detail.orderNumber}</span>
                          <span className={`ai-order-status ${ORDER_STATUS_STYLES[detail.status] || ""}`}>{t(detail.statusAr)}</span>
                        </div>
                        <div className="ai-order-customer">
                          <strong>{detail.customerName}</strong>
                          <a href={`tel:${detail.customerPhone}`} dir="ltr"><Phone size={12} /> {detail.customerPhone}</a>
                        </div>
                        <div className="ai-order-items-table">
                          {detail.items.map((item, itemIndex) => (
                            <div className="ai-order-line" key={itemIndex}>
                              <span className="ai-order-line-name">{ar ? item.nameAr : (item.name || item.nameAr)} <b>×{item.qty}</b></span>
                              <span className="ai-order-line-dots" />
                              <span className="ai-order-line-total">{moneyFmt(item.lineTotal)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="ai-order-breakdown">
                          <div><span>{t("المجموع الفرعي")}</span><b>{moneyFmt(detail.subtotal)}</b></div>
                          {detail.discount ? <div className="ai-order-discount"><span>{t("الخصم")}{detail.couponCode ? ` (${detail.couponCode})` : ""}</span><b>− {moneyFmt(detail.discount)}</b></div> : null}
                          <div><span>{t("الشحن")}</span><b>{detail.shipping ? moneyFmt(detail.shipping) : t("مجاني")}</b></div>
                          <div className="ai-order-grand"><span>{t("الإجمالي")}</span><b>{moneyFmt(detail.total)}</b></div>
                        </div>
                        {detail.customerAddress ? (
                          <p className="ai-order-address"><MapPin size={12} /> {detail.customerAddress}</p>
                        ) : null}
                        <div className="ai-order-foot">
                          {detail.cancelRequested ? <span className="ai-order-cancel-flag">{t("طلب إلغاء معلّق")}</span> : null}
                          {detail.device ? <span className="ai-order-device">{detail.device}</span> : null}
                          <span className="ai-order-date">{new Date(detail.createdAt).toLocaleDateString(dateLocale, { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    );
                  }
                  if (action.orders?.length) {
                    return (
                      <div className="ai-orders-stack" key={`c${index}`}>
                        {action.orders.map(order => (
                          <div className="ai-order-card" key={order.orderNumber}>
                            <div className="ai-order-head">
                              <span className="ai-order-num"><Package size={13} /> {order.orderNumber}</span>
                              <span className={`ai-order-status ${ORDER_STATUS_STYLES[order.status] || ""}`}>{t(order.statusAr)}</span>
                            </div>
                            <div className="ai-order-customer">
                              <strong>{order.customerName}</strong>
                              <a href={`tel:${order.customerPhone}`} dir="ltr"><Phone size={12} /> {order.customerPhone}</a>
                            </div>
                            <p className="ai-order-items">{order.itemsSummary}</p>
                            <div className="ai-order-foot">
                              <b>{moneyFmt(order.total)}</b>
                              {order.couponCode ? <span className="ai-order-coupon">{t("كوبون")} {order.couponCode}</span> : null}
                              {order.cancelRequested ? <span className="ai-order-cancel-flag">{t("طلب إلغاء معلّق")}</span> : null}
                              <span className="ai-order-date">{new Date(order.createdAt).toLocaleDateString(dateLocale, { day: "numeric", month: "long" })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if (action.needsConfirm && action.dryRun) {
                    return (
                      <div className="ai-bulk-card" key={`c${index}`}>
                        <div className="ai-bulk-head"><Layers size={14} /> {t("تعديل جماعي")} — {action.bulkCount} {action.bulkCount === 1 ? t("منتج") : t("منتجات")}</div>
                        {action.bulkNames?.length ? (
                          <p className="ai-bulk-names">{action.bulkNames.join(ar ? "، " : ", ")}{(action.bulkCount || 0) > (action.bulkNames.length) ? " …" : ""}</p>
                        ) : null}
                        <span className="ai-bulk-line">◇ {action.summary}</span>
                        {canExecute && (
                          <button className="button button-dark" disabled={pending} onClick={() => void send("أكّدي تنفيذ العملية الجماعية الأخيرة", "execute")}>
                            <Zap size={13} /> {t("تأكيد التنفيذ")}
                          </button>
                        )}
                      </div>
                    );
                  }
                  if (action.dryRun) {
                    return (
                      <div className="ai-dryrun-card" key={`c${index}`}>
                        <span className="ai-dryrun-line">◇ {action.summary}</span>
                      </div>
                    );
                  }
                  return (
                    <div className={`ai-action-note ${action.ok ? "" : "err"}`} key={`c${index}`}>
                      {action.ok ? "✓" : "✕"} {action.summary}
                    </div>
                  );
                })}
                {item.executed?.some(a => a.dryRun && !a.needsConfirm) && item.userRequest && canExecute && (
                  <div className="ai-actions">
                    <button className="button button-dark" disabled={pending} onClick={() => void send(item.userRequest, "execute")}>
                      <Zap size={13} /> {t("تنفيذ الآن")}
                    </button>
                  </div>
                )}
                {item.from === "ai" && item.text && (
                  <div className="ai-actions">
                    <button className="ai-mini" onClick={() => setMessage(ar ? `عدّلي الطلب السابق: ` : `Follow up on the previous request: `)}>{t("تعديل الطلب")}</button>
                    <button className="ai-mini" onClick={() => setMessages(current => current.filter((_, index) => index !== i))}><X size={12} /> {t("حذف")}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {pending && (
            <div className="chat-bubble ai">
              <div className="bubble-avatar">✦</div>
              <div><p className="ai-thinking"><Loader2 size={13} className="spin" /> {t("بشتغل على طلبكِ…")}</p></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {attachments.length > 0 && (
          <div className="ai-pending-images">
            {attachments.map(image => (
              <div key={image.name}>
                <img src={image.url} alt={image.name} />
                <button onClick={() => setAttachments(current => current.filter(item => item.name !== image.name))}>×</button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-input">
          <label className="icon-button" title={t("رفع صور")}>
            <Upload size={18} />
            <input type="file" accept="image/*" multiple hidden onChange={event => { void addImages(event.target.files); event.currentTarget.value = ""; }} />
          </label>
          <label className="icon-button" title={t("كاميرا")}>
            <Camera size={18} />
            <input type="file" accept="image/*" capture="environment" hidden onChange={event => { void addImages(event.target.files); event.currentTarget.value = ""; }} />
          </label>
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !pending) void send(); }}
            placeholder={mode === "execute" ? t("اكتبي أمرًا… مثال: عدّلي سعر بوكس الجامعة إلى 180 وانشريه") : t("اكتبي طلبكِ لمعاينته أولًا…")}
          />
          <button className="send-button" onClick={() => void send()} disabled={pending} aria-label={t("إرسال")}>{pending ? "…" : <Send size={17} />}</button>
        </div>
        <span className="chat-disclaimer">
          {mode === "execute"
            ? t("وضع التنفيذ المباشر: كل أمر يُسجَّل في سجل التدقيق باسمكِ — ولا تصل مفاتيح النظام إلى المساعد أبدًا.")
            : t("وضع المعاينة: لا يتغير شيء في المتجر حتى تختاري «تنفيذ الآن».")}
        </span>
        <button className="tool-button" onClick={() => setMessages([{ from: "ai", text: t("تم مسح المحادثة. أرسلي طلبًا جديدًا عندما تكونين جاهزة.") }])}>{t("مسح المحادثة")}</button>
      </div>

      {editingProduct && (
        <AiProductEditModal
          product={editingProduct}
          onClose={() => setEditingSlug(null)}
          onSaved={ref => { patchProductInMessages(ref.slug, ref); onCreated(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────── product card (single result + catalog grid)
// R160 — extracted so a get_catalog result renders every match as the same
// fully-editable card the executed actions earn: تعديل المنتج opens the
// editor straight from the AI result.
function AiProductCard({ product, onEdit, onToggle }: {
  product: AiProductRef; onEdit: () => void; onToggle: () => void;
}) {
  const t = useAdminT();
  const ar = useAdminAr();
  const moneyFmt = useAdminMoney();
  return (
    <div className="ai-result-card">
      <div className="ai-result-media">
        <img src={product.image} alt={product.nameAr} />
        {product.visible
          ? <span className="ai-result-state live">{t("منشور")}</span>
          : <span className="ai-result-state hidden">{t("مخفي")}</span>}
      </div>
      <div className="ai-result-info">
        <span className="eyebrow">{ar ? (product.categoryAr || product.category) : (product.category || product.categoryAr)}{product.featured ? t(" · مميّز") : ""}</span>
        <strong>{ar ? product.nameAr : (product.name || product.nameAr)}</strong>
        <div className="ai-result-price">
          <b>{moneyFmt(product.price)}</b>
          {product.oldPrice ? <s>{moneyFmt(product.oldPrice)}</s> : null}
        </div>
        <span className="ai-result-stock">{t("المخزون:")} {product.stock} {t("قطعة")}</span>
        <div className="ai-result-actions">
          <button className="button button-dark" onClick={onEdit}>
            <Pencil size={13} /> {t("تعديل المنتج")}
          </button>
          <a className="button button-outline" href={`#/product/${product.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink size={13} /> {t("عرض في المتجر")}
          </a>
          <button className="icon-button" title={product.visible ? t("إخفاء من المتجر") : t("نشر في المتجر")} onClick={onToggle}>
            {product.visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── product editor (from AI result)
// R160 — the AI-result editor IS the same shared full editor the dashboard's
// products section uses (ProductFormModal): identity, pricing, images
// (upload / remove / make-main), variants, publishing — one source of truth.
function AiProductEditModal({ product, onClose, onSaved }: {
  product: Product; onClose: () => void; onSaved: (ref: AiProductRef) => void;
}) {
  return (
    <ProductFormModal
      product={product}
      eyebrow="AI RESULT / EDIT"
      onClose={onClose}
      onSaved={saved => onSaved({
        slug: saved.id, name: saved.name, nameAr: saved.nameAr,
        category: saved.category, categoryAr: saved.categoryAr,
        price: saved.price, oldPrice: saved.oldPrice ?? null,
        stock: saved.stock, visible: saved.visible !== false, featured: !!saved.featured,
        image: saved.images?.[0] || saved.image || "/images/p-beauty-box.webp",
      })}
    />
  );
}

// ─────────────────────────────────────────────── AI provider settings (owner)
function AiSettingsPanel() {
  const [info, setInfo] = useState<AiSettingsInfo | null>(null);
  const [provider, setProvider] = useState<"zai" | "gemini">("zai");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const t = useAdminT();

  useEffect(() => {
    api<AiSettingsInfo>("/api/admin/ai/settings").then(data => {
      setInfo(data);
      setProvider(data.provider);
      if (data.geminiModel) setModel(data.geminiModel);
    }).catch(() => toast.error(t("تعذر تحميل إعدادات الذكاء الاصطناعي")));
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<AiSettingsInfo & { success?: boolean }>("/api/admin/ai/settings", post("/api/admin/ai/settings", {
        provider,
        ...(key.trim() ? { geminiApiKey: key.trim() } : {}),
        geminiModel: model.trim() || "gemini-2.0-flash",
      }));
      setInfo(current => current ? { ...current, provider: res.provider, geminiModel: res.geminiModel, hasKey: res.hasKey, keyTail: res.keyTail } : current);
      setKey("");
      setTestResult(null);
      toast.success(t("تم حفظ إعدادات الذكاء الاصطناعي"));
    } catch (e) { toast.error(e instanceof Error ? e.message : t("تعذر الحفظ")); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true);
    setTestResult(null);
    try {
      const res = await api<{ ok: boolean; message: string }>("/api/admin/ai/settings", post("/api/admin/ai/settings", {
        test: true,
        ...(key.trim() ? { geminiApiKey: key.trim() } : {}),
        geminiModel: model.trim() || undefined,
      }));
      setTestResult(res);
    } catch (e) { setTestResult({ ok: false, message: e instanceof Error ? e.message : t("فشل الاختبار") }); }
    finally { setBusy(false); }
  };

  return (
    <div className="ai-settings-panel">
      <div className="ai-settings-head">
        <strong><Settings2 size={14} /> {t("إعدادات محرك الذكاء الاصطناعي")}</strong>
        <span>{t("للمالكة فقط — المفتاح يُخزَّن في الخادم ولا يظهر للمساعد أبدًا.")}</span>
      </div>
      <div className="ai-settings-grid">
        <div className="ai-settings-field">
          <span>{t("المحرك")}</span>
          <div className="ai-mode-toggle small">
            <button className={provider === "gemini" ? "active" : ""} onClick={() => setProvider("gemini")}>Gemini API</button>
            <button className={provider === "zai" ? "active" : ""} onClick={() => setProvider("zai")}>{t("المساعد الداخلي")}</button>
          </div>
        </div>
        <label className="ai-settings-field">
          <span>{t("موديل Gemini")}</span>
          <input dir="ltr" value={model} onChange={e => setModel(e.target.value)} placeholder="gemini-2.0-flash" />
        </label>
        <label className="ai-settings-field wide">
          <span>{t("مفتاح Gemini API")} {info?.hasKey ? <em className="ai-key-tail">{t("محفوظ:")} {info.keyTail}{info.fromEnv ? ` ${t("(من بيئة النظام)")}` : ""}</em> : null}</span>
          <input dir="ltr" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={info?.hasKey ? t("اتركيه فارغًا للإبقاء على المفتاح الحالي") : t("ألصقي مفتاح AIza… من aistudio.google.com")} />
        </label>
      </div>
      <div className="ai-settings-actions">
        <button className="button button-dark" onClick={() => void save()} disabled={busy}><Check size={14} /> {t("حفظ الإعدادات")}</button>
        <button className="button button-outline" onClick={() => void test()} disabled={busy}><Sparkles size={14} /> {t("اختبار الاتصال")}</button>
        {testResult && <span className={`ai-test-result ${testResult.ok ? "ok" : "err"}`}>{testResult.ok ? "✓ " : "✕ "}{testResult.message}</span>}
      </div>
      <p className="form-hint">{t("عند اختيار Gemini يصبح كل مساعد المتجر (فهم الصور + تنفيذ الأوامر) يعمل بموديل Gemini الذي تحددينه.")}</p>
    </div>
  );
}
