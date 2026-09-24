"use client";

// LUBNÉL Admin Studio — full dashboard: overview, orders, products, coupons, categories,
// media, homepage hero, analytics, settings, users & roles, audit, AI assistant
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bell, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, Download, Eye, Heart, Image as ImageIcon,
  LayoutDashboard, Layers, ListFilter, Mail, MapPin, Menu, MessageCircle, MoreHorizontal, Package, Pencil, Pin, PinOff,
  Phone, Plus, Search, Send, Settings2, Share2, ShieldCheck, ShoppingBag, Sparkles, Star, Tags, ThumbsUp, Ticket, Trash2,
  TrendingDown, TrendingUp, Upload, UserCog, Users, ScrollText, Volume2, VolumeX, X, Camera, Gift, Minus,
} from "lucide-react";
import { toast } from "sonner";
import { io, type Socket } from "socket.io-client";
import { compressImage, formatEgyptPhone, normalizeEgyptPhone, usePersistedState } from "@/lib/lubnel-helpers";
import { BrandMark } from "@/components/lubnel/chrome";
import {
  AdminLangProvider, runtimeAr, runtimeMoney, runtimeT, setRuntimeAdminLang,
  useAdminAr, useAdminDateLocale, useAdminLangCtx, useAdminMoney, useAdminT, type AdminLang,
} from "@/lib/admin-i18n";
import { AISection } from "@/components/lubnel/admin/ai-section";
import { ProductFormModal } from "@/components/lubnel/admin/product-form-modal";
import {
  ADMIN_PERMISSIONS, CATEGORY_LABELS_AR, ORDER_STATUS_LABELS,
  type AdminProfile, type OrderRecord, type Product, type HeroSlide,
} from "@/lib/lubnel-types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "فشل الطلب");
  return data as T;
}
const post = (url: string, body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const adminNav = [
  ["overview", "نظرة عامة", LayoutDashboard, "analytics.read"],
  ["orders", "الطلبات", Package, "orders.read"],
  ["reviews", "المراجعات", Star, "products.read"],
  ["products", "المنتجات", Tags, "products.read"],
  ["coupons", "الكوبونات والخصومات", Tags, "settings.read"],
  ["categories", "الفئات", ListFilter, "products.read"],
  ["media", "مكتبة الصور", ImageIcon, "media.read"],
  ["homepage", "الصفحة الرئيسية", Sparkles, "homepage.write"],
  ["analytics", "التحليلات", BarChart3, "analytics.read"],
  ["settings", "الإعدادات", Settings2, "settings.read"],
  ["users", "المستخدمون والأدوار", UserCog, "users.read"],
  ["audit", "سجل التدقيق", ScrollText, "audit.read"],
  ["ai", "مساعد LUBNÉL AI", MessageCircle, "ai.use"],
] as const;

const statusLabel = (s: string) => ORDER_STATUS_LABELS[s] || s;

// ─────────────────────────────────────────────── live updates (socket.io)
export type LiveEventRecord = {
  id: string;
  kind: "order:new" | "order:cancel_requested" | "order:cancel_resolved" | "order:status_changed" | "review:new" | "review:moderated" | "review:helpful" | "product:changed";
  title: string;
  desc: string;
  at: string;
  phone?: string;
  seq?: number;
  replayed?: boolean;
};

// R65 — wa.me targets must be INTERNATIONAL digits. R64's normalizer turns
// any historically stored shape ("+20 101 234 5678", Arabic digits, "2010…")
// into canonical 01X first, so a legacy row can no longer produce wa.me/220…
// (double country code → a stranger's phone). Unfixable rows keep the old
// digits pass-through; callers that render a link guard with waReachable.
const waIntlDigits = (phone: string): string => {
  const norm = normalizeEgyptPhone(phone);
  return norm ? `2${norm.slice(1)}` : phone.replace(/[^0-9]/g, "");
};
const waLink = (phone: string, text: string) =>
  `https://wa.me/${waIntlDigits(phone)}?text=${encodeURIComponent(text)}`;
// Reachable = a real Egyptian mobile behind it (2 + 01X + 8 digits = 11).
const waReachable = (phone: string): boolean => waIntlDigits(phone).length >= 11;

// One formatter shared by live handlers AND the reconnect replay path
const describeLiveEvent = (kind: LiveEventRecord["kind"], d: Record<string, unknown>): { title: string; desc: string; phone?: string } => {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const n = (v: unknown) => (typeof v === "number" ? v : undefined);
  const ar = runtimeAr();
  const by = (v: string) => `${ar ? "بواسطة" : "by"} ${v || (ar ? "الإدارة" : "the admin")}`;
  switch (kind) {
    case "order:new":
      return { title: ar ? `طلب جديد ${s(d.orderNumber)}` : `New order ${s(d.orderNumber)}`, desc: `${s(d.customerName) || runtimeT("عميلة")} · ${n(d.itemCount) ?? "—"} ${ar ? "قطع" : "items"} · ${runtimeMoney(n(d.total) || 0)}`, phone: s(d.phone) || undefined };
    case "order:cancel_requested":
      return { title: ar ? `طلب إلغاء ${s(d.orderNumber)}` : `Cancel request ${s(d.orderNumber)}`, desc: ar ? `من ${s(d.customerName) || "عميلة"} — بانتظار المراجعة` : `From ${s(d.customerName) || "a customer"} — awaiting review` };
    case "order:cancel_resolved": {
      const approve = d.resolution === "approve";
      return { title: ar ? `${approve ? "قبول" : "رفض"} إلغاء ${s(d.orderNumber)}` : `${approve ? "Accepted" : "Rejected"} cancellation ${s(d.orderNumber)}`, desc: by(s(d.by)) };
    }
    case "order:status_changed":
      return { title: ar ? `تحديث حالة ${s(d.orderNumber)}` : `Status update ${s(d.orderNumber)}`, desc: `${runtimeT(statusLabel(s(d.status)))} · ${by(s(d.by))}` };
    case "review:new":
      return { title: ar ? `تقييم جديد ${"★".repeat(Math.max(1, Math.min(5, n(d.rating) || 5)))}` : `New review ${"★".repeat(Math.max(1, Math.min(5, n(d.rating) || 5)))}`, desc: ar ? `${s(d.name) || "عميلة"} على ${s(d.productTitle) || "منتج"}` : `${s(d.name) || "A customer"} on ${s(d.productTitle) || "a product"}` };
    case "review:moderated": {
      const action = s(d.action);
      const label = action === "approved" ? runtimeT("نشر تقييم") : action === "unpublished" ? runtimeT("إخفاء تقييم")
        : action === "featured" ? runtimeT("تثبيت تقييم بالرئيسية") : action === "unfeatured" ? runtimeT("إزالة تقييم من الرئيسية") : runtimeT("حذف تقييم");
      return { title: label, desc: by(s(d.by)) };
    }
    case "review:helpful":
      return { title: runtimeT("👍 تصويت «مفيد» جديد"), desc: ar ? `تقييم ${s(d.name) || "عميلة"} — ${n(d.helpfulCount) || 1} تصويت الآن` : `Review by ${s(d.name) || "a customer"} — ${n(d.helpfulCount) || 1} ${runtimeT("تصويت الآن")}` };
    case "product:changed": {
      const action = s(d.action);
      const label = action === "created" ? runtimeT("منتج جديد") : action === "deleted" ? runtimeT("حذف منتج") : action === "bulk" ? ar ? `تحديث جماعي (${n(d.count) ?? "؟"} منتج)` : `Bulk update (${n(d.count) ?? "?"} products)` : runtimeT("تعديل منتج");
      const via = s(d.by) ? (ar ? ` · بواسطة ${s(d.by)}` : ` · by ${s(d.by)}`) : "";
      return { title: `${label} ${s(d.nameAr) || ""}`.trim(), desc: `${s(d.by)?.includes("AI") || s(d.by)?.includes("ai") ? runtimeT("✦ عبر المساعد الذكي") : runtimeT("من لوحة التحكم")}${via}` };
    }
  }
};

const LIVE_KIND_META: Record<LiveEventRecord["kind"], { label: string; icon: string }> = {
  "order:new": { label: "طلب جديد", icon: "🛍️" },
  "order:cancel_requested": { label: "طلب إلغاء", icon: "✕" },
  "order:cancel_resolved": { label: "مراجعة إلغاء", icon: "✓" },
  "order:status_changed": { label: "تحديث حالة", icon: "⟳" },
  "review:new": { label: "تقييم جديد", icon: "★" },
  "review:moderated": { label: "مراجعة التقييمات", icon: "✓" },
  "review:helpful": { label: "تصويت مفيد", icon: "👍" },
  "product:changed": { label: "تحديث منتجات", icon: "🏷️" },
};

// Status-aware WhatsApp notification templates (per order status)
const WA_TEMPLATES: Record<string, (o: OrderRecord) => string> = {
  new: o => `أهلًا ${o.customerName} 🌸\nاستلمنا طلبكِ ${o.orderNumber} بنجاح، وفريقنا يراجعه الآن — سنؤكد لكِ قريبًا.\n— فريق LUBNÉL`,
  confirmed: o => `أهلًا ${o.customerName} 🌸\nتم تأكيد طلبكِ ${o.orderNumber} ✅ وبدأنا التحضير له بعناية.\n— فريق LUBNÉL`,
  preparing: o => `أهلًا ${o.customerName} 🌷\nطلبكِ ${o.orderNumber} قيد التجهيز الآن في ستوديو LUBNÉL — نغلّفه بعناية ليصلكِ بأفضل حال.\n— فريق LUBNÉL`,
  shipped: o => `أهلًا ${o.customerName} 🚚\nخبر جميل! طلبكِ ${o.orderNumber} خرج للشحن وسيصلكِ خلال ١–٢ يوم عمل، ويتم التواصل معكِ عند الوصول.\n— فريق LUBNÉL`,
  completed: o => `أهلًا ${o.customerName} 🌸\nتم توصيل طلبكِ ${o.orderNumber} بنجاح! نتمنى لكِ تجربة جمال رائعة — وسيسعدنا قراءة تقييمكِ للمنتجات على المتجر ✨\n— فريق LUBNÉL`,
  cancelled: o => `أهلًا ${o.customerName}،\nتم إلغاء الطلب ${o.orderNumber}. نأسف على الإزعاج، ونتشرف بزيارتكِ مجددًا 🌷\n— فريق LUBNÉL`,
};
const waOrderMsg = (o: OrderRecord) => (WA_TEMPLATES[o.status] || WA_TEMPLATES.new)(o);

function useAdminLive(onOrdersChanged: () => void, onReviewsChanged: () => void, onProductsChanged?: () => void) {
  const socketRef = useRef<Socket | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [events, setEvents] = useState<LiveEventRecord[]>([]);
  const [unread, setUnread] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const onOrdersChangedRef = useRef(onOrdersChanged);
  const onReviewsChangedRef = useRef(onReviewsChanged);
  const onProductsChangedRef = useRef(onProductsChanged);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(false);
  useEffect(() => {
    onOrdersChangedRef.current = onOrdersChanged;
  }, [onOrdersChanged]);
  useEffect(() => {
    onReviewsChangedRef.current = onReviewsChanged;
  }, [onReviewsChanged]);
  useEffect(() => {
    onProductsChangedRef.current = onProductsChanged;
  }, [onProductsChanged]);
  // Restore the sound preference (client-only — the studio mounts after auth check)
  useEffect(() => {
    try {
      const on = window.localStorage.getItem("lubnel-live-sound") === "1";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSoundOn(on);
      soundOnRef.current = on;
    } catch { /* private mode */ }
  }, []);

  // Soft two-note chime via WebAudio — no asset needed, works everywhere
  const playChime = useCallback(() => {
    if (!soundOnRef.current) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      [[0, 880], [0.14, 1174.7]].forEach(([offset, freq]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq as number;
        gain.gain.setValueAtTime(0, now + (offset as number));
        gain.gain.linearRampToValueAtTime(0.16, now + (offset as number) + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (offset as number) + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + (offset as number));
        osc.stop(now + (offset as number) + 0.55);
      });
    } catch { /* autoplay restrictions — ignore */ }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn(prev => {
      const next = !prev;
      soundOnRef.current = next;
      try { window.localStorage.setItem("lubnel-live-sound", next ? "1" : "0"); } catch { /* private mode */ }
      if (next) {
        // Create/unlock the AudioContext inside the same user gesture
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume();
        } catch { /* ignore */ }
        playChime();
      }
      return next;
    });
  }, [playChime]);

  // Last seen replay sequence — persisted so the bell can show what was missed while closed
  const lastSeqRef = useRef(0);
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem("lubnel-live-seq"));
      if (Number.isFinite(stored) && stored >= 0) lastSeqRef.current = stored;
    } catch { /* private mode */ }
  }, []);
  const bumpSeq = useCallback((seq?: number) => {
    if (typeof seq !== "number" || !Number.isFinite(seq) || seq <= lastSeqRef.current) return;
    lastSeqRef.current = seq;
    try { window.localStorage.setItem("lubnel-live-seq", String(seq)); } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    // Connect through the Caddy gateway — NEVER a bare port URL.
    const socket = io("/?XTransformPort=3010", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
      timeout: 8000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setLiveConnected(true);
      socket.emit("admin:join", { lastSeq: lastSeqRef.current });
    });
    socket.on("disconnect", () => setLiveConnected(false));

    const push = (record: Omit<LiveEventRecord, "id" | "at">) => {
      const rec: LiveEventRecord = { ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString() };
      setEvents(prev => [rec, ...prev].slice(0, 25));
      setUnread(u => u + 1);
    };

    socket.on("order:new", (d: { orderNumber?: string; customerName?: string; total?: number; itemCount?: number; phone?: string; seq?: number }) => {
      push({ kind: "order:new", ...describeLiveEvent("order:new", d as Record<string, unknown>), seq: d.seq });
      bumpSeq(d.seq);
      playChime();
      toast.success(runtimeAr() ? `🛍️ طلب جديد! ${d.orderNumber || ""}` : `🛍️ New order! ${d.orderNumber || ""}`, {
        description: `${d.customerName || runtimeT("عميلة")} · ${d.itemCount || "—"} ${runtimeAr() ? "قطع" : "items"} · ${runtimeMoney(d.total || 0)}`,
        action: d.phone ? { label: runtimeT("واتساب"), onClick: () => window.open(waLink(d.phone!, `أهلًا ${d.customerName || ""} 🌸 نشكركِ على طلبك ${d.orderNumber} في LUBNÉL`), "_blank") } : undefined,
      });
      onOrdersChangedRef.current();
    });
    socket.on("order:cancel_requested", (d: { orderNumber?: string; customerName?: string; seq?: number }) => {
      push({ kind: "order:cancel_requested", ...describeLiveEvent("order:cancel_requested", d as Record<string, unknown>), seq: d.seq });
      bumpSeq(d.seq);
      playChime();
      toast.warning(runtimeAr() ? `✕ طلب إلغاء ${d.orderNumber || ""}` : `✕ Cancel request ${d.orderNumber || ""}`, { description: runtimeAr() ? `${d.customerName || "عميلة"} تطلب إلغاء الطلب — راجعيه من صفحة الطلبات` : `${d.customerName || "A customer"} asked to cancel the order — review it on the orders page` });
      onOrdersChangedRef.current();
    });
    socket.on("order:cancel_resolved", (d: { orderNumber?: string; resolution?: string; by?: string; seq?: number }) => {
      push({ kind: "order:cancel_resolved", ...describeLiveEvent("order:cancel_resolved", d as Record<string, unknown>), seq: d.seq });
      bumpSeq(d.seq);
    });
    socket.on("order:status_changed", (d: { orderNumber?: string; status?: string; by?: string; seq?: number }) => {
      push({ kind: "order:status_changed", ...describeLiveEvent("order:status_changed", d as Record<string, unknown>), seq: d.seq });
      bumpSeq(d.seq);
    });
    socket.on("review:new", (d: { productTitle?: string; rating?: number; name?: string; seq?: number }) => {
      push({ kind: "review:new", ...describeLiveEvent("review:new", d as Record<string, unknown>), seq: d.seq });
      bumpSeq(d.seq);
      playChime();
      toast.info(runtimeAr() ? `★ تقييم جديد من ${d.name || "عميلة"}` : `★ New review from ${d.name || "a customer"}`, { description: runtimeAr() ? `${d.productTitle || "منتج"} — بانتظار الموافقة في صفحة المراجعات` : `${d.productTitle || "A product"} — pending approval on the reviews page` });
      onReviewsChangedRef.current();
    });
    socket.on("review:moderated", (d: { action?: string; by?: string; seq?: number }) => {
      push({ kind: "review:moderated", ...describeLiveEvent("review:moderated", d as Record<string, unknown>), seq: d.seq });
      bumpSeq(d.seq);
      onReviewsChangedRef.current();
    });
    socket.on("review:helpful", (d: { name?: string; helpfulCount?: number; seq?: number }) => {
      push({ kind: "review:helpful", ...describeLiveEvent("review:helpful", d as Record<string, unknown>), seq: d.seq });
      bumpSeq(d.seq);
    });
    socket.on("product:changed", (d: { action?: string; nameAr?: string; slug?: string; by?: string; seq?: number }) => {
      push({ kind: "product:changed", ...describeLiveEvent("product:changed", d as Record<string, unknown>), seq: d.seq });
      bumpSeq(d.seq);
      onProductsChangedRef.current?.();
    });

    // Reconnect replay: events that fired while the studio was closed/offline.
    // No chime, no individual toasts — one summary toast + silent list entries.
    socket.on("live:replay", (payload: { events?: Array<{ seq?: number; event?: string; data?: Record<string, unknown>; at?: string }>; current?: number }) => {
      const missed = (payload.events || []).filter((e): e is { seq?: number; event: string; data?: Record<string, unknown>; at?: string } =>
        typeof e.event === "string" && e.event in LIVE_KIND_META);
      if (missed.length === 0) { bumpSeq(payload.current); return; }
      let touchedOrders = false;
      let touchedReviews = false;
      let touchedProducts = false;
      missed.forEach(e => {
        const kind = e.event as LiveEventRecord["kind"];
        const info = describeLiveEvent(kind, e.data || {});
        push({ kind, ...info, seq: e.seq, replayed: true });
        bumpSeq(e.seq);
        if (kind.startsWith("order:")) touchedOrders = true;
        if (kind.startsWith("review:")) touchedReviews = true;
        if (kind === "product:changed") touchedProducts = true;
      });
      bumpSeq(payload.current);
      if (touchedOrders) onOrdersChangedRef.current();
      if (touchedReviews) onReviewsChangedRef.current();
      if (touchedProducts) onProductsChangedRef.current?.();
      toast.info(runtimeAr() ? `↺ ${missed.length} إشعارًا جديدًا أثناء غيابكِ` : `↺ ${missed.length} new notifications while you were away`, { description: runtimeAr() ? "ملخّصة في جرس الإشعارات المباشرة الآن" : "Summarized in the live notifications bell now" });
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [playChime, bumpSeq]);

  return { liveConnected, events, unread, markRead: () => setUnread(0), soundOn, toggleSound };
}

function RelativeTime({ iso }: { iso: string }) {
  const ar = useAdminAr();
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const txt = mins < 1 ? runtimeT("الآن") : mins < 60 ? ar ? `منذ ${mins} د` : `${mins}m ago` : mins < 1440 ? ar ? `منذ ${Math.floor(mins / 60)} س` : `${Math.floor(mins / 60)}h ago` : ar ? `منذ ${Math.floor(mins / 1440)} يوم` : `${Math.floor(mins / 1440)}d ago`;
  return <time className="live-time" dateTime={iso}>{txt}</time>;
}

function LiveBell({ events, unread, connected, soundOn, onToggleSound, onOpen, onNavigate }: {
  events: LiveEventRecord[]; unread: number; connected: boolean; soundOn: boolean;
  onToggleSound: () => void; onOpen: () => void; onNavigate: (section: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ar = useAdminAr();
  const t = useAdminT();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const goto = (section: string) => { setOpen(false); onNavigate(section); };
  return (
    <div className="live-bell-wrap" ref={ref}>
      <button
        className="icon-button"
        aria-label={ar ? `الإشعارات المباشرة${unread ? ` (${unread} جديدة)` : ""}` : `Live notifications${unread ? ` (${unread} new)` : ""}`}
        aria-expanded={open}
        onClick={() => { setOpen(o => !o); if (!open) onOpen(); }}
      >
        <Bell size={18} />
        {unread > 0 && <b className="live-unread" aria-hidden>{unread > 9 ? "+9" : unread}</b>}
        <i className={connected ? "live-dot" : "live-dot off"} title={connected ? t("متصلة بالبث المباشر") : t("غير متصلة")} />
      </button>
      {open && (
        <div className="live-panel" role="dialog" aria-label={t("الإشعارات المباشرة")}>
          <div className="live-panel-head">
            <strong>{t("الإشعارات المباشرة")}</strong>
            <div className="live-panel-head-tools">
              <button
                className={`live-sound-toggle ${soundOn ? "on" : ""}`}
                onClick={onToggleSound}
                aria-pressed={soundOn}
                title={soundOn ? t("إيقاف صوت التنبيهات") : t("تشغيل صوت التنبيهات")}
              >
                {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{soundOn ? t("الصوت مفعّل") : t("الصوت مكتوم")}</span>
              </button>
              <span className={`live-status ${connected ? "on" : ""}`}>{connected ? t("● متصل") : t("○ غير متصل")}</span>
            </div>
          </div>
          {events.length === 0 ? (
            <p className="live-empty">{t("لا إشعارات بعد — ستصلكِ الأحداث لحظة حدوثها أثناء تصفحكِ هنا ✨")}</p>
          ) : (
            <ul className="live-list">
              {events.map(ev => (
                <li key={ev.id} className={`live-item kind-${ev.kind}`}>
                  <span className="live-icon" aria-hidden>{LIVE_KIND_META[ev.kind].icon}</span>
                  <div className="live-item-body">
                    <strong>{ev.title}</strong>
                    <span>{ev.desc}</span>
                  </div>
                  <div className="live-item-side">
                    <RelativeTime iso={ev.at} />
                    {ev.replayed && <span className="live-replay-chip" title={t("حدث أثناء تصفحكِ خارج الاستوديو")}>{t("↺ أثناء غيابكِ")}</span>}
                    {ev.phone && ev.kind === "order:new" && (
                      <a
                        href={waLink(ev.phone, `أهلًا 🌸 بخصوص طلبكِ في LUBNÉL`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="live-wa"
                        title={t("مراسلة العميلة على واتساب")}
                      >{t("واتساب")}</a>
                    )}
                    {(ev.kind === "review:new" || ev.kind === "review:moderated" || ev.kind === "review:helpful") && (
                      <button className="live-goto" onClick={() => goto("reviews")} title={t("فتح صفحة المراجعات")}>{t("عرض التقييمات")}</button>
                    )}
                    {ev.kind === "order:cancel_requested" && (
                      <button className="live-goto" onClick={() => goto("orders")} title={t("فتح صفحة الطلبات")}>{t("عرض الطلبات")}</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Shared pagination bar for admin tables
function PaginationBar({ page, pages, total, onPage, label = "سجل" }: { page: number; pages: number; total: number; onPage: (p: number) => void; label?: string }) {
  const t = useAdminT();
  const ar = useAdminAr();
  if (pages <= 1) return null;
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="pagination-bar">
      <span className="page-info">{ar ? `صفحة ${page} من ${pages} · ${total} ${t(label)}` : `Page ${page} of ${pages} · ${total} ${t(label)}`}</span>
      <div className="pagination-controls">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t("السابق")}>‹</button>
        {nums.map((n, i) => n === "…"
          ? <span key={`dots-${i}`} className="page-dots">…</span>
          : <button key={n} className={n === page ? "active" : ""} onClick={() => onPage(n)} aria-current={n === page ? "page" : undefined}>{n}</button>)}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label={t("التالي")}>›</button>
      </div>
    </div>
  );
}

export type AdminReviewRecord = {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string | null;
  name: string;
  text: string;
  rating: number;
  image: string | null;
  approved: boolean;
  featured: boolean;
  helpfulCount: number;
  createdAt: string;
};

export function AdminStudio({ admin, onLogout }: { admin: AdminProfile; onLogout: () => void }) {
  const [lang, setLang] = usePersistedState<AdminLang>("lubnel-admin-lang", "ar");
  const ar = lang === "ar";

  // The studio owns the document direction while mounted (storefront effect only
  // re-runs on ITS lang change, so flipping admin lang here is authoritative).
  // On unmount, restore the storefront's persisted language.
  useEffect(() => {
    setRuntimeAdminLang(lang);
    document.documentElement.dir = ar ? "rtl" : "ltr";
    document.documentElement.lang = ar ? "ar" : "en";
    let storeLang: AdminLang = "ar";
    try { if (window.localStorage.getItem("lubnel-lang") === "en") storeLang = "en"; } catch { /* private mode */ }
    return () => {
      document.documentElement.dir = storeLang === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = storeLang;
    };
  }, [ar, lang]);

  return (
    <AdminLangProvider lang={lang} setLang={setLang}>
      <StudioShell admin={admin} onLogout={onLogout} />
    </AdminLangProvider>
  );
}

// Everything below the provider so its own chrome (nav, topbar, sidebar) also
// reads the live language from context.
function StudioShell({ admin, onLogout }: { admin: AdminProfile; onLogout: () => void }) {
  const [section, setSection] = useState("overview");
  // R32 — which tab the orders section opens on (overview gift chip jumps to "gifts")
  const [ordersTab, setOrdersTab] = useState("all");
  // R43 — which coupon the orders section opens filtered by (analytics drill deep-link)
  const [ordersCoupon, setOrdersCoupon] = useState<string | null>(null);
  // R45 — which product the orders section opens filtered by (drill product-row
  // hand-off). Always carries the code whose drawer it came from, so the return
  // crumb can re-open that exact drill. The two filters are mutually exclusive:
  // jumping to one clears the other (no stale double-chip on arrival).
  const [ordersProduct, setOrdersProduct] = useState<{ slug: string; name: string; code: string } | null>(null);
  // R52 — order-mix source drill (coupon / rail / organic), same jump pattern
  const [ordersSource, setOrdersSource] = useState<string | null>(null);
  // R53 — week window (days) riding the same jump plumbing: the mix trend's
  // delta chips jump to that source INSIDE the same 7-day window the chip
  // classified. Legend chips (all-time) and every non-source jump clear it,
  // so a chip's number and the landed view can never disagree.
  const [ordersDays, setOrdersDays] = useState<number | null>(null);
  // R44 — deep-link round trip: the code the orders view should return to
  // analytics with (re-opening that code's drill drawer on arrival).
  const [drillReturnCode, setDrillReturnCode] = useState<string | null>(null);
  const { setLang, ar, t } = useAdminLangCtx();
  const [mobileNav, setMobileNav] = useState(false);
  const [showProduct, setShowProduct] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [ordersVersion, setOrdersVersion] = useState(0);
  const [reviewStats, setReviewStats] = useState({ pending: 0, published: 0, total: 0 });
  // R117 — cancel-pending badge state, fed by the orders route's per-tab count
  const [cancelPending, setCancelPending] = useState(0);

  const loadProducts = useCallback(async () => {
    try {
      const data = await api<{ products: Product[] }>("/api/admin/products");
      setProducts(data.products);
    } catch { /* permission handled per-section */ }
  }, []);
  const loadOrders = useCallback(async () => {
    try {
      const data = await api<{ orders: OrderRecord[]; counts?: Record<string, number> }>("/api/admin/orders");
      setOrders(data.orders);
      // R117 — the cancel-pending badge rides the shell's load cycle: the
      // orders route computes the full-universe cancel-request count on EVERY
      // call (independent of the tab filter), so the sidebar badge is always
      // the SAME number the cancel tab shows — two paths, one number.
      setCancelPending(data.counts?.["cancel-request"] ?? 0);
      setOrdersVersion(v => v + 1); // signal server-paged OrdersSection to refetch
    } catch { /* ignore */ }
  }, []);
  const loadReviewStats = useCallback(async () => {
    try {
      const data = await api<{ stats: { pending: number; published: number; total: number } }>("/api/admin/reviews?stats=1");
      setReviewStats(data.stats);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts(); void loadOrders(); void loadReviewStats();
  }, [loadProducts, loadOrders, loadReviewStats, refreshFlag]);

  // R46 — sales pulse: greet the owner with the orders that landed since her
  // last studio visit (localStorage bookkeeping, one toast per mount). The
  // first visit only baseline-marks the count — no toast on day one. Real
  // milestone crossings (10 / 25 / 50 / 100 / 250 / 500 / 1000) add a second
  // celebration layer. Gold family = sales identity, same as the revenue
  // numbers; customer data is never altered, this only reads counts.
  const pulseFiredRef = useRef(false);
  useEffect(() => {
    if (pulseFiredRef.current || !orders.length) return;
    pulseFiredRef.current = true;
    const KEY = "lubnel-orders-pulse";
    let prev: number | null = null;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) prev = JSON.parse(raw)?.count ?? null;
    } catch { /* private mode */ }
    try { window.localStorage.setItem(KEY, JSON.stringify({ count: orders.length, at: Date.now() })); } catch { /* ignore */ }
    if (prev === null || prev >= orders.length) return;
    const delta = orders.length - prev;
    const deltaAr = delta === 1 ? "طلب جديد" : delta === 2 ? "طلبان جديدان" : delta <= 10 ? `${delta} طلبات جديدة` : `${delta} طلبًا جديدًا`;
    toast.success(ar ? `💰 ${deltaAr} منذ زيارتكِ الأخيرة` : `💰 ${delta} new order${delta === 1 ? "" : "s"} since your last visit`, {
      className: "sales-pulse-toast",
      description: ar ? `إجمالي الدفتر: ${orders.length} طلب — الكل في صفحة الطلبات` : `The book is at ${orders.length} orders total — all on the orders page`,
    });
    const MILESTONES = [10, 25, 50, 100, 250, 500, 1000];
    const hit = MILESTONES.find(m => prev < m && m <= orders.length);
    if (hit) {
      toast.success(ar ? `🎉 مبروك — الطلب رقم ${hit} وصل!` : `🎉 Milestone — order #${hit} landed!`, {
        className: "sales-pulse-toast milestone",
        description: ar ? "دفتر LUBNÉL بيكبر — تستاهلي كل نجاح" : "The LUBNÉL book keeps growing — you earned this",
        duration: 8000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const has = (p: string) => admin.permissions.includes(p);
  const navTitle = adminNav.find(n => n[0] === section)?.[1];
  const visibleNav = adminNav.filter(([id, , , perm]) =>
    id === "overview" || has(perm as string));

  const { liveConnected, events, unread, markRead, soundOn, toggleSound } = useAdminLive(
    () => { void loadOrders(); },
    () => { void loadReviewStats(); },
    () => { void loadProducts(); },
  );

  return (
    <main className="admin-shell" dir={ar ? "rtl" : "ltr"}>
      <aside className={`admin-sidebar ${mobileNav ? "open" : ""}`}>
        <div className="admin-brand"><BrandMark /><span>STUDIO</span></div>
        <div className="admin-store-switch">
          <div className="store-avatar">L</div>
          <div><strong>LUBNÉL</strong><span>lubnel.com</span></div>
        </div>
        <nav>
          {visibleNav.map(([id, label, Icon]) => (
            <button className={section === id ? "active" : ""} onClick={() => { setSection(id); setMobileNav(false); }} key={id}>
              <Icon size={17} />{t(label)}
              {id === "orders" && orders.length > 0 && <b>{orders.filter(o => o.status === "new").length}</b>}
              {/* R117 — the cancel-pending badge: visible from ANY section, so a
                  customer's cancel request is never silently waiting. Same
                  nav-pending treatment the reviews badge earned. */}
              {id === "orders" && cancelPending > 0 && <b className="nav-pending">{cancelPending}</b>}
              {id === "reviews" && reviewStats.pending > 0 && <b className="nav-pending">{reviewStats.pending}</b>}
            </button>
          ))}
        </nav>
        <div className="admin-side-footer">
          <div className={`live-connection ${liveConnected ? "on" : ""}`} aria-live="polite">
            <span className="live-dot" aria-hidden />
            {liveConnected ? t("البث المباشر متصل") : t("البث المباشر غير متصل")}
          </div>
          <div className="admin-user">
            <div className="user-avatar">{admin.displayName[0]}</div>
            <div><strong>{admin.displayName}</strong><span>{admin.role === "owner" ? t("مالكة المتجر") : admin.customRole || admin.role}</span></div>
            <MoreHorizontal size={16} />
          </div>
          <a href="#/" className="view-store"><Eye size={16} /> {t("مشاهدة المتجر")}</a>
          <button className="view-store logout" onClick={onLogout}><X size={16} /> {t("تسجيل الخروج")}</button>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div><span className="eyebrow">LUBNÉL / STUDIO</span><h1>{navTitle ? t(navTitle) : ""}</h1></div>
          <div className="admin-top-actions">
            <button
              className="admin-lang-toggle"
              onClick={() => setLang(ar ? "en" : "ar")}
              title={ar ? "Switch to English" : "التبديل إلى العربية"}
              aria-label={ar ? "Switch studio to English" : "التبديل إلى العربية"}
            >{ar ? "EN" : "ع"}</button>
            <LiveBell
              events={events}
              unread={unread}
              connected={liveConnected}
              soundOn={soundOn}
              onToggleSound={toggleSound}
              onOpen={markRead}
              onNavigate={setSection}
            />
            <div className="admin-top-avatar">{admin.displayName[0]}</div>
          </div>
        </header>
        {section === "overview" && <OverviewSection products={products} orders={orders} setSection={setSection} adminName={admin.displayName} onOpenGifts={() => { setOrdersTab("gifts"); setOrdersDays(null); setSection("orders"); }} onOpenRailOrders={() => { setOrdersSource("rail"); setOrdersCoupon(null); setOrdersProduct(null); setOrdersDays(null); setOrdersTab("all"); setSection("orders"); }} onOpenWeekOrders={() => { setOrdersDays(7); setOrdersSource(null); setOrdersCoupon(null); setOrdersProduct(null); setOrdersTab("all"); setSection("orders"); }} />}
        {section === "orders" && <OrdersSection refreshKey={ordersVersion} reload={loadOrders} initialTab={ordersTab} initialCoupon={ordersCoupon ?? undefined} initialProduct={ordersProduct ?? undefined} initialSource={ordersSource ?? undefined} initialDays={ordersDays ?? undefined} onBackToCouponDrill={(code) => { setDrillReturnCode(code || null); setSection("analytics"); }} onBackToSourceMix={() => { setDrillReturnCode(null); setSection("analytics"); }} />}
        {section === "reviews" && <ReviewsSection onChanged={() => { void loadReviewStats(); }} />}
        {section === "products" && <ProductsSection products={products} reload={loadProducts} openAdd={() => setShowProduct(true)} />}
        {section === "coupons" && <CouponsSection />}
        {section === "categories" && <CategoriesSection />}
        {section === "media" && <MediaSection />}
        {section === "homepage" && <HomepageSection />}
        {section === "analytics" && <AnalyticsSection orders={orders} products={products} onOpenGifts={() => { setOrdersTab("gifts"); setOrdersDays(null); setSection("orders"); }} onOpenCouponOrders={(code) => { setOrdersCoupon(code); setOrdersProduct(null); setOrdersSource(null); setOrdersDays(null); setOrdersTab("all"); setSection("orders"); }} onOpenProductOrders={(slug, name, code) => { setOrdersProduct({ slug, name, code }); setOrdersCoupon(null); setOrdersSource(null); setOrdersDays(null); setOrdersTab("all"); setSection("orders"); }} onOpenSourceOrders={(src, days) => { setOrdersSource(src); setOrdersDays(days ?? null); setOrdersCoupon(null); setOrdersProduct(null); setOrdersTab("all"); setSection("orders"); }} initialOpenCode={drillReturnCode ?? undefined} />}
        {section === "settings" && <SettingsSection />}
        {section === "users" && <UsersSection />}
        {section === "audit" && <AuditSection />}
        {section === "ai" && has("ai.use") && <AISection products={products} onCreated={() => { void loadProducts(); setRefreshFlag(f => f + 1); }} isOwner={admin.role === "owner"} canExecute={has("ai.execute")} />}
      </section>
      {showProduct && (
        <AddProductModal
          onClose={() => setShowProduct(false)}
          onCreated={() => { setShowProduct(false); void loadProducts(); }}
        />
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────── Overview
function OverviewSection({ products, orders, setSection, adminName, onOpenGifts, onOpenRailOrders, onOpenWeekOrders }: {
  products: Product[]; orders: OrderRecord[]; setSection: (s: string) => void; adminName: string; onOpenGifts: () => void; onOpenRailOrders: () => void; onOpenWeekOrders: () => void;
}) {
  const [stats, setStats] = useState<{ totals: Record<string, number>; days: { label: string; total: number }[]; railConversions?: number } | null>(null);
  const t = useAdminT();
  const ar = useAdminAr();
  const moneyFmt = useAdminMoney();
  const dateLocale = useAdminDateLocale();
  useEffect(() => { api<{ totals: Record<string, number>; days: { label: string; total: number }[]; railConversions?: number }>("/api/admin/stats").then(setStats).catch(() => undefined); }, []);
  const today = new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const maxDay = Math.max(1, ...(stats?.days || []).map(d => d.total));
  return (
    <div className="admin-content">
      <div className="dashboard-welcome">
        <div>
          <span className="eyebrow">{today}</span>
          <h2>{t("صباح الخير يا")} {adminName.split(" ")[0]} <span>✦</span></h2>
          <p>{t("إليكِ لمحة سريعة عن LUBNÉL اليوم.")}</p>
        </div>
        <button className="button button-dark" onClick={() => setSection("ai")}><Sparkles size={16} /> {t("اسألي LUBNÉL AI")}</button>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span>{t("إجمالي الطلبات")}</span>
          <strong>{stats?.totals.orders ?? orders.length}</strong>
          <small className="positive">{t("محسوبة من كامل السجل")}</small>
          <div className="mini-bars">
            {(stats?.days || [20, 45, 35, 65, 50, 80, 70].map(v => ({ total: v }))).slice(-7).map((d, i) => (
              <i key={i} style={{ height: `${Math.max(12, (d.total / maxDay) * 100)}%` }} />
            ))}
          </div>
        </div>
        <div className="stat-card">
          <span>{t("إجمالي المبيعات")}</span>
          <strong>{(stats?.totals.revenue ?? 0).toLocaleString("en-US")} <small>{t("ج.م")}</small></strong>
          <small className="positive">{t("الطلبات المسجلة فعليًا")}</small>
          <div className="sparkline"><svg viewBox="0 0 150 44" preserveAspectRatio="none"><path d="M0,38 C20,35 28,31 40,33 S62,15 76,25 S95,28 107,17 S128,20 150,4" fill="none" stroke="currentColor" strokeWidth="2" /></svg></div>
        </div>
        <div className="stat-card">
          <span>{t("متوسط قيمة الطلب")}</span>
          <strong>{(stats?.totals.average ?? 0).toLocaleString("en-US")} <small>{t("ج.م")}</small></strong>
          <small>{t("لكل طلب")}</small>
          <div className="mini-bars muted"><i style={{ height: "45%" }} /><i style={{ height: "35%" }} /><i style={{ height: "55%" }} /><i style={{ height: "40%" }} /><i style={{ height: "70%" }} /><i style={{ height: "58%" }} /><i style={{ height: "78%" }} /></div>
        </div>
        <div className="stat-card">
          <span>{t("منتجات منخفضة المخزون")}</span>
          <strong>{String(stats?.totals.lowStock ?? products.filter(p => p.stock < 10).length).padStart(2, "0")}</strong>
          <small className="negative">{t("تحتاج متابعة")}</small>
          <div className="stock-dots"><i /><i /><i /><i /><i /></div>
        </div>
      </div>
      <div className="dashboard-grid">
        <div className="panel best-panel">
          <div className="panel-head"><div><h3>{t("الأكثر تمييزًا")}</h3><span>{t("منتجات مميزة في الواجهة")}</span></div><button onClick={() => setSection("products")}>{t("عرض الكل")} <ArrowLeft size={14} /></button></div>
          {products.slice(0, 4).map((p, i) => (
            <div className="best-row" key={p.id}>
              <span className="rank">0{i + 1}</span>
              <img src={p.image} alt="" loading="lazy" decoding="async" />
              <div><strong>{ar ? p.nameAr : (p.name || p.nameAr)}</strong><span>{t("مخزون")} {p.stock} · {ar ? p.categoryAr : (p.category || p.categoryAr)}</span></div>
              <b>{moneyFmt(p.price)}</b>
            </div>
          ))}
        </div>
        <div className="panel recent-panel">
          <div className="panel-head">
            <div><h3>{t("أحدث الطلبات")}</h3><span>{t("تحتاج متابعة")}</span></div>
            <div className="panel-head-actions">
              {/* R32 — gift-note adoption chip → opens the orders gift office view */}
              <button
                type="button"
                className="gift-week-chip"
                onClick={onOpenGifts}
                title={ar
                  ? `طلبات ببطاقة هدية: ${stats?.totals.giftOrdersWeek ?? 0} هذا الأسبوع · ${stats?.totals.giftOrders ?? 0} بالإجمال — اضغطي لعرضها`
                  : `Gift-note orders: ${stats?.totals.giftOrdersWeek ?? 0} this week · ${stats?.totals.giftOrders ?? 0} lifetime — click to view`}
              >
                <Gift size={11} aria-hidden />
                {(() => {
                  const week = stats?.totals.giftOrdersWeek ?? 0;
                  const lifetime = stats?.totals.giftOrders ?? 0;
                  return ar
                    ? (week === 1 ? "هدية واحدة هذا الأسبوع" : `${week} هدايا هذا الأسبوع · ${lifetime} بالإجمال`)
                    : (week === 1 ? `1 gift this week · ${lifetime} total` : `${week} gifts this week · ${lifetime} total`);
                })()}
              </button>
              {/* R52 — rail-attribution KPI: orders that arrived through a
                  converted cross-sell rail click. Honest presence — only
                  rendered once the rail has actually sold something; the jump
                  lands in the orders view filtered to the rail source (the
                  R52 mix drill plumbing). */}
              {(stats?.railConversions ?? 0) > 0 && (
                <button
                  type="button"
                  className="gift-week-chip rail-kpi-chip"
                  onClick={onOpenRailOrders}
                  title={ar
                    ? `طلبات جاءت عبر ريل المقترحات: ${stats?.railConversions} — اضغطي لعرضها`
                    : `Orders that came through the cross-sell rail: ${stats?.railConversions} — click to view`}
                >
                  <Sparkles size={11} aria-hidden />
                  {ar ? `من الريل: ${stats?.railConversions}` : `From rail: ${stats?.railConversions}`}
                </button>
              )}
              {/* R54 — rolling-week KPI: orders in the SAME window the mix
                  trend classifies and the orders API days=7 filter uses
                  (ALL statuses — pure time). Always rendered: unlike the
                  rail chip, a zero week IS the signal ("quiet week"). The
                  jump lands in the orders view with the week window chip —
                  chip number == landed total, guaranteed by construction. */}
              <button
                type="button"
                className="gift-week-chip week-kpi-chip"
                onClick={onOpenWeekOrders}
                title={ar
                  ? `طلبات آخر ٧ أيام (بكل الحالات): ${stats?.totals.weekOrders ?? 0} — اضغطي لعرضها`
                  : `Orders from the last 7 days (all statuses): ${stats?.totals.weekOrders ?? 0} — click to view`}
              >
                <Clock size={11} aria-hidden />
                {(() => {
                  const n = stats?.totals.weekOrders ?? 0;
                  return ar
                    ? (n === 0 ? "لا طلبات في آخر ٧ أيام" : n === 1 ? "طلب واحد في آخر ٧ أيام" : `آخر ٧ أيام: ${n} طلب`)
                    : (n === 0 ? "No orders in the last 7 days" : n === 1 ? `1 order in the last 7 days` : `Last 7 days: ${n} orders`);
                })()}
              </button>
              <button onClick={() => setSection("orders")}>{t("كل الطلبات")} <ArrowLeft size={14} /></button>
            </div>
          </div>
          <div className="admin-table">
            <div className="table-row table-label"><span>{t("الطلب")}</span><span>{t("العميل")}</span><span>{t("التاريخ")}</span><span>{t("الإجمالي")}</span><span>{t("الحالة")}</span><span /></div>
            {orders.slice(0, 5).map(o => (
              <div className="table-row" key={o.id}>
                <span className="order-id">{o.orderNumber}</span>
                <span>{o.customerName}</span>
                <span>{new Date(o.createdAt).toLocaleString(dateLocale)}</span>
                <span>{moneyFmt(o.total)}</span>
                <span><em className={`status status-${o.status}`}>{t(statusLabel(o.status))}</em></span>
                <MoreHorizontal size={17} />
              </div>
            ))}
            {orders.length === 0 && <div className="empty-state"><Package size={22} /><p>{t("لا توجد طلبات بعد — أول طلب واتساب سيظهر هنا تلقائيًا.")}</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Orders
// ─────────────────────────────────────────────────────────── Reviews moderation

// Fullscreen viewer for customer photos on moderation cards — same visual language
// as the storefront lightbox (`.review-lightbox`), arrows flip between every review
// that carries a photo in the current filter. Admin is RTL: right arrow = previous.
type LightboxItem = { id: string; src: string; name: string; product: string; rating: number };
function AdminPhotoLightbox({ items, index, onIndex, close }: {
  items: LightboxItem[]; index: number; onIndex: (i: number) => void; close: () => void;
}) {
  const t = useAdminT();
  const total = items.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") onIndex((index - 1 + total) % total);
      if (e.key === "ArrowLeft") onIndex((index + 1) % total);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [index, total, close, onIndex]);
  const item = items[index];
  if (!item) return null;
  return (
    <div className="review-lightbox admin" onClick={close} role="dialog" aria-modal="true" aria-label={t("صورة من تقييم") + " " + item.name}>
      <button className="lightbox-close" onClick={close} aria-label={t("إغلاق العارض")}><X size={19} /></button>
      {total > 1 && (
        <>
          <button className="lightbox-nav nav-prev" onClick={e => { e.stopPropagation(); onIndex((index - 1 + total) % total); }} aria-label={t("الصورة السابقة")}><ChevronRight size={24} /></button>
          <button className="lightbox-nav nav-next" onClick={e => { e.stopPropagation(); onIndex((index + 1) % total); }} aria-label={t("الصورة التالية")}><ChevronLeft size={24} /></button>
        </>
      )}
      <figure className="lightbox-figure" onClick={e => e.stopPropagation()} key={index}>
        <img src={item.src} alt={`${t("صورة من")} ${item.name}`} loading="lazy" decoding="async" />
        <figcaption>
          <div className="lightbox-caption-top">
            <span className="stars" aria-hidden>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</span>
            <strong>{item.name}</strong>
            <span className="lightbox-counter" dir="ltr">{index + 1} / {total}</span>
          </div>
          <p>{t("على منتج:")} {item.product}</p>
        </figcaption>
      </figure>
    </div>
  );
}

function ReviewsSection({ onChanged }: { onChanged: () => void }) {
  const [reviews, setReviews] = useState<AdminReviewRecord[] | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "published">("all");
  const [busyId, setBusyId] = useState("");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const t = useAdminT();
  const ar = useAdminAr();
  const dateLocale = useAdminDateLocale();
  const load = useCallback(async () => {
    try {
      const data = await api<{ reviews: AdminReviewRecord[] }>("/api/admin/reviews");
      setReviews(data.reviews);
    } catch {
      setReviews([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (review: AdminReviewRecord, action: "approve" | "unpublish" | "delete" | "feature" | "unfeature") => {
    if (action === "delete" && !confirm(ar ? `حذف تقييم ${review.name} على "${review.productTitle}" نهائيًا؟` : `Delete the review by ${review.name} on "${review.productTitle}" permanently?`)) return;
    setBusyId(review.id);
    try {
      await api("/api/admin/reviews", post("/api/admin/reviews", { id: review.id, action }));
      toast.success(
        action === "approve" ? ar ? `تم نشر تقييم ${review.name} على "${review.productTitle}"` : `Review by ${review.name} on "${review.productTitle}" published`
        : action === "unpublish" ? t("تم إخفاء التقييم من صفحة المنتج")
        : action === "feature" ? t("تم تثبيت التقييم في الصفحة الرئيسية ✨")
        : action === "unfeature" ? t("تم إزالة التقييم من الصفحة الرئيسية")
        : t("تم حذف التقييم نهائيًا"),
      );
      await load();
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل تنفيذ الطلب")); }
    finally { setBusyId(""); }
  };

  const pending = (reviews || []).filter(r => !r.approved).length;
  const published = (reviews || []).filter(r => r.approved).length;
  const shown = (reviews || []).filter(r => filter === "all" || (filter === "pending" ? !r.approved : r.approved));
  const tabs: (["all" | "pending" | "published", string, number])[] = [["all", t("الكل"), (reviews || []).length], ["pending", t("بانتظار الموافقة"), pending], ["published", t("منشورة"), published]];
  // every review in the current filter that carries a customer photo — feeds the lightbox
  const photoItems: LightboxItem[] = shown.filter(r => r.image).map(r => ({ id: r.id, src: r.image as string, name: r.name, product: r.productTitle, rating: r.rating }));

  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("المراجعات")} <small>{(reviews || []).length}</small></h2><p>{t("تقييمات العملاء تصل هنا أولًا للموافقة — المنشور فقط هو ما يظهر في صفحة المنتج.")}</p></div>
      </div>
      <div className="order-tabs">
        {tabs.map(([id, label, count]) => (
          <button className={`${filter === id ? "active" : ""} ${id === "pending" && count > 0 ? "tab-attention" : ""}`} onClick={() => { setFilter(id); setLightboxIdx(null); }} key={id}>
            {label} <b>{count}</b>
          </button>
        ))}
      </div>
      {reviews === null ? (
        <div className="admin-loading"><span className="spinner" aria-label={t("جارٍ التحميل")} /></div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <Star size={22} />
          <p>{filter === "pending" ? t("لا توجد تقييمات بانتظار الموافقة — كل شيء مراجع ✨") : t("لا توجد تقييمات بعد — أول تقييم من العميلة سيظهر هنا تلقائيًا.")}</p>
        </div>
      ) : (
        <div className="reviews-grid">
          {shown.map(r => (
            <article className={`review-mod-card ${r.approved ? "" : "is-pending"}`} key={r.id}>
              {r.image && (
                <button
                  className="review-mod-photo"
                  onClick={() => setLightboxIdx(photoItems.findIndex(it => it.id === r.id))}
                  title={t("عرض صورة العميلة بالحجم الكامل")}
                  aria-label={`${t("تكبير صورة التقييم من")} ${r.name}`}
                >
                  <img src={r.image} alt={`${t("صورة من")} ${r.name}`} loading="lazy" decoding="async" />
                  <span className="review-mod-photo-zoom" aria-hidden><Search size={11} /> {t("تكبير")}</span>
                </button>
              )}
              <div className="review-mod-main">
                <div className="review-mod-head">
                  <span className="review-mod-product">
                    {r.productImage && <img src={r.productImage} alt="" aria-hidden loading="lazy" decoding="async" />}
                    <span>
                      <strong>{r.productTitle}</strong>
                      <a href={`#/product/${r.productId}`} className="review-mod-link" title={t("فتح صفحة المنتج")}>{t("عرض في المتجر ↗")}</a>
                    </span>
                  </span>
                  <span className="review-mod-states">
                    {r.featured && <em className="review-mod-featured" title={t("مثبّت في الصفحة الرئيسية")}><Pin size={12} /> {t("مثبّت بالرئيسية")}</em>}
                    <em className={`review-mod-state ${r.approved ? "on" : ""}`}>{r.approved ? t("منشور") : t("بانتظار الموافقة")}</em>
                  </span>
                </div>
                <span className="review-mod-stars" aria-label={`${r.rating} ${ar ? "من 5" : "of 5"}`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                <blockquote className="review-mod-text">{r.text}</blockquote>
                <div className="review-mod-meta">
                  <span className="review-mod-avatar" aria-hidden>{r.name[0]}</span>
                  <span className="review-mod-name">{r.name}</span>
                  {r.helpfulCount > 0 && <em className="review-mod-helpful" title={t("عدد العميلات اللاتي وجدن هذا التقييم مفيدًا")}><ThumbsUp size={11} /> {r.helpfulCount} {t("مفيد")}</em>}
                  <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString(dateLocale, { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}</time>
                </div>
                <div className="review-mod-actions">
                  {r.approved ? (
                    r.featured ? (
                      <button className="tool-button featured" onClick={() => act(r, "unfeature")} disabled={busyId === r.id} title={t("إزالة التقييم من قسم آراء العميلات في الرئيسية")}><PinOff size={15} /> {t("إزالة من الرئيسية")}</button>
                    ) : (
                      <>
                        <button className="tool-button" onClick={() => act(r, "unpublish")} disabled={busyId === r.id}><Eye size={15} /> {t("إلغاء النشر")}</button>
                        <button className="tool-button feature" onClick={() => act(r, "feature")} disabled={busyId === r.id} title={t("نشر التقييم وتثبيته في قسم آراء العميلات بالصفحة الرئيسية")}><Pin size={15} /> {t("تثبيت بالرئيسية")}</button>
                      </>
                    )
                  ) : (
                    <button className="tool-button approve" onClick={() => act(r, "approve")} disabled={busyId === r.id}><CheckCheck size={15} /> {t("نشر التقييم")}</button>
                  )}
                  <button className="tool-button danger" onClick={() => act(r, "delete")} disabled={busyId === r.id}><Trash2 size={15} /> {t("حذف")}</button>
                  {busyId === r.id && <span className="spinner" aria-label={t("جارٍ التنفيذ")} />}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {lightboxIdx !== null && photoItems.length > 0 && (
        <AdminPhotoLightbox items={photoItems} index={Math.min(lightboxIdx, photoItems.length - 1)} onIndex={setLightboxIdx} close={() => setLightboxIdx(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Orders
const ORDER_PAGE_SIZES = [12, 25, 50] as const;

function OrdersSection({ refreshKey = 0, reload, initialTab = "all", initialCoupon, initialProduct, initialSource, initialDays, onBackToCouponDrill, onBackToSourceMix }: { orders?: OrderRecord[]; refreshKey?: number; reload?: () => void; initialTab?: string; initialCoupon?: string; initialProduct?: { slug: string; name: string; code: string }; initialSource?: string; initialDays?: number; onBackToCouponDrill?: (code: string) => void; onBackToSourceMix?: () => void }) {
  const reloadRef = useRef(reload);
  useEffect(() => { reloadRef.current = reload; }, [reload]);
  const t = useAdminT();
  const ar = useAdminAr();
  const moneyFmt = useAdminMoney();
  const dateLocale = useAdminDateLocale();
  // initialTab is read at mount only — the section remounts on every section
  // switch, so an overview-chip jump to the gift office view lands correctly.
  const [tab, setTab] = useState(initialTab);
  // R43 — coupon deep-link filter, read at mount like initialTab (the section
  // remounts on every switch, so an analytics drill jump lands correctly). A
  // removable plum chip above the table shows the active code.
  const [coupon, setCoupon] = useState(initialCoupon || "");
  // R45 — product deep-link filter, same mount-read pattern as the coupon chip.
  // Carries the source code so the return crumb re-opens that drill drawer.
  const [product, setProduct] = useState(initialProduct || null);
  // R52 — order-mix source drill, same mount-read pattern: the mix panel's
  // legend chips jump here filtered by acquisition source (coupon / rail /
  // organic). A removable gold chip shows the active source.
  const [source, setSource] = useState(initialSource || "");
  // R53 — week window, same mount-read pattern: the mix TREND chips jump here
  // with the same 7-day window they classified (source + days together).
  // A removable chip shows the active window; clearing it widens the view
  // back to all time without touching the source filter.
  const [days, setDays] = useState(initialDays || 0);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OrderRecord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  // Sticky per-owner page size (12/25/50) — persisted like the studio language
  const [perPage, setPerPage] = usePersistedState<number>("lubnel-orders-per-page", 12);
  // R65 — per-row copy feedback: the chip's icon swaps to a check for a beat
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const copyTimer = useRef<number | null>(null);

  // 300ms debounce on the search box — typing never fires a request per key
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(perPage) });
    if (tab !== "all") params.set("status", tab);
    if (coupon) params.set("coupon", coupon);
    if (product) params.set("product", product.slug);
    if (source) params.set("source", source);
    if (days) params.set("days", String(days));
    if (debouncedQ) params.set("q", debouncedQ);
    try {
      const data = await api<{ orders: OrderRecord[]; total: number; pages: number; counts: Record<string, number> }>(`/api/admin/orders?${params.toString()}`);
      setRows(data.orders);
      setTotal(data.total);
      setPages(data.pages);
      setCounts(data.counts || {});
      setError("");
      setPage(p => Math.min(p, data.pages)); // clamp if the dataset shrank
    } catch (e) {
      setError(e instanceof Error ? e.message : t("فشل التحميل"));
      setRows([]);
    }
  }, [page, tab, debouncedQ, perPage, coupon, product, source, days, t]);

  // One effect drives all refetches: query changes (load identity) AND live-event
  // bumps from the parent (refreshKey) — a single fetch on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  // R29 — orders CSV is now a server-side full-history stream (uncapped,
  // RFC-4180-quoted, UTF-8 BOM for Excel/Arabic, audit-logged): the old client
  // build paged max 20×100 orders and broke on commas inside names.
  // R65 — hand the owner the canonical digits the fulfilment spine actually
  // dials. Clipboard API first, execCommand textarea fallback for the rare
  // non-secure context; the toast echoes the GROUPED form so she can eyeball
  // what landed on her clipboard before pasting into WhatsApp.
  const copyPhone = async (o: OrderRecord) => {
    const digits = normalizeEgyptPhone(o.customerPhone) || o.customerPhone.trim();
    let done = false;
    try { await navigator.clipboard.writeText(digits); done = true; } catch { /* fall through */ }
    if (!done) {
      try {
        const ta = document.createElement("textarea");
        ta.value = digits;
        ta.setAttribute("style", "position:fixed;opacity:0");
        document.body.appendChild(ta);
        ta.select();
        done = document.execCommand("copy");
        ta.remove();
      } catch { /* ignore */ }
    }
    if (!done) { toast.error(ar ? "تعذّر النسخ — انسخي الرقم يدويًا" : "Copy failed — copy the number manually"); return; }
    toast.success(ar ? `تم نسخ ${formatEgyptPhone(digits)} — جاهزي للصق في واتساب` : `${formatEgyptPhone(digits)} copied — ready to paste`);
    setCopiedId(o.id);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), 1800);
  };
  const changeStatus = async (order: OrderRecord, status: string) => {
    try {
      await api("/api/admin/orders", post("/api/admin/orders", { id: order.id, status }));
      toast.success(ar ? `تم تحديث حالة ${order.orderNumber}` : `${order.orderNumber} status updated`);
      void load();
      reloadRef.current?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل التحديث")); }
  };
  const resolveCancel = async (order: OrderRecord, resolution: "approve" | "reject") => {
    const approve = resolution === "approve";
    if (!confirm(approve
      ? ar ? `قبول إلغاء الطلب ${order.orderNumber}؟ سيتم تغيير حالته إلى "ملغي".` : `Accept cancelling ${order.orderNumber}? Its status will become "Cancelled".`
      : ar ? `رفض طلب الإلغاء والاستمرار في تنفيذ ${order.orderNumber}؟` : `Reject the cancellation request and keep processing ${order.orderNumber}?`)) return;
    try {
      await api("/api/admin/orders", post("/api/admin/orders", { id: order.id, action: "resolve-cancel", resolution }));
      const waMsg = approve
        ? `أهلًا ${order.customerName} 🌸\nتم قبول طلب إلغاء الطلب ${order.orderNumber}. إذا كان الدفع عند الاستلام فلا حاجة لأي إجراء، وإن كان الدفع مسبقًا فسيتم رد المبلغ كاملًا.\nنأسف على الإزعاج ونتشرف بزيارتكِ مجددًا 🌷\n— فريق LUBNÉL`
        : `أهلًا ${order.customerName} 🌸\nبخصوص طلبكِ ${order.orderNumber}: طلب الإلغاء لم نتمكن من قبوله لأن الطلب قيد التجهيز حاليًا — وسنوافيكِ بتفاصيل الشحن قريبًا.\nشكرًا لتفهمكِ ويمكنكِ التواصل معنا لأي استفسار ✨\n— فريق LUBNÉL`;
      toast.success(approve ? ar ? `تم إلغاء ${order.orderNumber}` : `${order.orderNumber} cancelled` : ar ? `تم استمرار ${order.orderNumber} — الإلغاء مرفوض` : `${order.orderNumber} continues — cancellation rejected`, {
        description: ar ? "أبلغي العميلة بقرار الإلغاء عبر واتساب" : "Let the customer know via WhatsApp",
        action: { label: t("إشعار العميلة"), onClick: () => window.open(waLink(order.customerPhone, waMsg), "_blank") },
        duration: 10000,
      });
      void load();
      reloadRef.current?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل تنفيذ الطلب")); }
  };
  const tabs = [["all", t("الكل")], ["cancel-request", t("طلبات إلغاء")], ["gifts", t("هدايا")], ["new", t("جديد")], ["confirmed", t("مؤكد")], ["preparing", t("قيد التجهيز")], ["shipped", t("تم الشحن")], ["completed", t("مكتمل")], ["cancelled", t("ملغي")]];
  const shown = rows || [];
  const safePage = Math.min(page, pages);
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("الطلبات")} <small>{total}</small></h2><p>{t("كل طلب واتساب يتم تسجيله داخليًا قبل الإرسال، مع دورة حالة كاملة.")}</p></div>
        <div className="content-head-actions">
          <div className="admin-search admin-search-full"><Search size={16} /><input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder={t("بحث برقم الطلب أو العميل أو الهاتف أو بطاقة الهدية")} /></div>
          <label className="page-size-wrap" title={t("عدد الطلبات المعروضة في كل صفحة")}>
            <Layers size={14} />
            <select className="page-size-select" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} aria-label={t("عدد الطلبات المعروضة في كل صفحة")}>
              {ORDER_PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <small>{t("لكل صفحة")}</small>
          </label>
          <a className="tool-button" href="/api/admin/orders/export" download title={t("تصدير كل الطلبات بدون حد — ملف CSV كامل")}><Download size={16} /> {t("تصدير CSV")}</a>
        </div>
      </div>
      <div className="order-tabs">
        {tabs.map(([id, label]) => {
          const count = counts[id] || 0;
          return (
            <button className={`${tab === id ? "active" : ""} ${id === "cancel-request" && count > 0 ? "tab-attention" : ""} ${id === "gifts" ? "tab-gifts" : ""}`} onClick={() => { setTab(id); setPage(1); }} key={id}>
              {id === "gifts" && <Gift size={11} aria-hidden />} {label} <b>{count}</b>
            </button>
          );
        })}
      </div>
      {/* R44/R45/R47/R52 — round trip: while the coupon OR product OR source
          filter from the analytics drill is active, a crumb returns to
          analytics AND re-opens that code's drawer (the product chip
          remembers the drawer it came from via initialProduct.code). A
          wish-board jump has no source coupon (code "") — the crumb still
          returns, but targets the wish panel and must NOT re-open any drawer
          ("" → null in StudioShell). A mix jump returns to the mix panel. */}
      {source && onBackToSourceMix ? (
        <button
          type="button"
          className="coupon-return-crumb"
          onClick={onBackToSourceMix}
          title={t("ارجعي إلى التحليلات")}
        >
          <ArrowRight size={12} aria-hidden />
          {t("الرجوع إلى مزيج الطلبات")}
        </button>
      ) : (coupon || product) && onBackToCouponDrill ? (
        <button
          type="button"
          className="coupon-return-crumb"
          onClick={() => onBackToCouponDrill(coupon || product!.code)}
          title={coupon || product!.code ? t("أعيدي فتح تفاصيل هذا الكود في التحليلات") : t("ارجعي إلى التحليلات")}
        >
          <ArrowRight size={12} aria-hidden />
          {coupon || product!.code ? t("الرجوع إلى تحليلات الكوبونات") : t("الرجوع إلى لوحة الأمنيات")}
        </button>
      ) : null}
      {coupon && (
        <span className="coupon-filter-chip" role="status" aria-label={`${t("فلتر الكوبون")}: ${coupon}`}>
          <Ticket size={11} aria-hidden />
          <span>{ar ? "كود" : "Code"}: <b dir="ltr">{coupon}</b></span>
          <button type="button" title={t("مسح فلتر الكوبون")} aria-label={t("مسح فلتر الكوبون")} onClick={() => { setCoupon(""); setPage(1); }}>
            <X size={11} aria-hidden />
          </button>
        </span>
      )}
      {product && (
        <span className="product-filter-chip" role="status" aria-label={`${t("فلتر المنتج")}: ${product.name}`}>
          <Package size={11} aria-hidden />
          <span>{t("منتج")}: <b>{product.name}</b></span>
          <button type="button" title={t("مسح فلتر المنتج")} aria-label={t("مسح فلتر المنتج")} onClick={() => { setProduct(null); setPage(1); }}>
            <X size={11} aria-hidden />
          </button>
        </span>
      )}
      {source && (
        <span className="product-filter-chip source-filter-chip" role="status" aria-label={`${t("فلتر المصدر")}: ${source === "coupon" ? t("كوبونات") : source === "rail" ? t("من الريل") : t("طبيعية")}`}>
          <Sparkles size={11} aria-hidden />
          <span>{t("المصدر")}: <b>{source === "coupon" ? t("كوبونات") : source === "rail" ? t("من الريل") : t("طبيعية")}</b></span>
          <button type="button" title={t("مسح فلتر المصدر")} aria-label={t("مسح فلتر المصدر")} onClick={() => { setSource(""); setPage(1); }}>
            <X size={11} aria-hidden />
          </button>
        </span>
      )}
      {days > 0 && (
        <span className="product-filter-chip week-filter-chip" role="status" aria-label={`${t("المدة")}: ${t("آخر ٧ أيام")}`}>
          <Clock size={11} aria-hidden />
          <span>{t("المدة")}: <b>{t("آخر ٧ أيام")}</b></span>
          <button type="button" title={t("مسح فلتر المدة")} aria-label={t("مسح فلتر المدة")} onClick={() => { setDays(0); setPage(1); }}>
            <X size={11} aria-hidden />
          </button>
        </span>
      )}
      <div className="panel admin-orders-panel">
        <div className="admin-table">
          <div className="table-row table-label"><span>{t("الطلب")}</span><span>{t("العميل")}</span><span>{t("التاريخ")}</span><span>{t("الإجمالي")}</span><span>{t("الحالة")}</span><span /></div>
          {rows === null ? (
            <div className="orders-skeleton" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => <div className="orders-skeleton-row" key={i} style={{ animationDelay: `${i * 70}ms` }} />)}
            </div>
          ) : (
            <>
              {shown.map(o => (
                <div className="table-row" key={o.id}>
                  <span className="order-id">{o.orderNumber}</span>
                  <span className="customer-cell"><span className="customer-avatar">{o.customerName[0]}</span>{o.customerName}{o.giftNote && <span className="gift-flag" title={o.giftNote}><Gift size={10} /> {t("هدية")}</span>}{o.railConverted && <span className="rail-flag" title={t("وصل هذا الطلب عبر نقرة من ريل المقترحات")}><Sparkles size={10} /> {t("من الريل")}</span>}<small><span className="phone-num" dir="ltr">{formatEgyptPhone(o.customerPhone)}</span><button type="button" className={`phone-copy${copiedId === o.id ? " copied" : ""}`} onClick={() => void copyPhone(o)} title={copiedId === o.id ? (ar ? "تم النسخ" : "Copied") : (ar ? "نسخ الرقم للواتساب" : "Copy the number for WhatsApp")} aria-label={`${ar ? "نسخ رقم" : "Copy number"} ${o.customerName}`}>{copiedId === o.id ? <Check size={11} /> : <Copy size={11} />}</button>{waReachable(o.customerPhone) ? <a className="row-wa" href={waLink(o.customerPhone, waOrderMsg(o))} target="_blank" rel="noopener noreferrer" title={`${t("رسالة واتساب جاهزة حسب حالة الطلب")} (${t(statusLabel(o.status))})`} aria-label={`${t("واتساب")} ${o.customerName}`}>{t("واتساب")}</a> : <span className="row-wa off" title={ar ? "رقم غير قابل للواتساب — لا نرسل أعميًا إلى رقم مشكوك فيه" : "Number can't reach WhatsApp — we never dial a doubtful one"}>{t("واتساب")}</span>}</small></span>
                  <span>{new Date(o.createdAt).toLocaleString(dateLocale)}</span>
                  <span>{moneyFmt(o.total)}{o.discount > 0 && <small className="positive">{t("خصم")} {moneyFmt(o.discount)}</small>}</span>
                  <span>
                    <select className={`status-select status-${o.status}`} value={o.status} onChange={e => changeStatus(o, e.target.value)} disabled={o.cancelRequested && o.status !== "cancelled"}>
                      {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                    </select>
                    {o.cancelRequested && o.status !== "cancelled" && <span className="cancel-flag"><X size={10} /> {t("إلغاء مطلوب")}</span>}
                  </span>
                  {o.cancelRequested && o.status !== "cancelled" ? (
                    <span className="cancel-resolve">
                      <button className="resolve-btn approve" onClick={() => resolveCancel(o, "approve")} title={t("قبول الإلغاء وتغيير الحالة إلى ملغي")}><Check size={13} /> {t("قبول")}</button>
                      <button className="resolve-btn reject" onClick={() => resolveCancel(o, "reject")} title={t("رفض طلب الإلغاء والاستمرار في التنفيذ")}><X size={13} /> {t("رفض")}</button>
                    </span>
                  ) : (
                    <MoreHorizontal size={17} />
                  )}
                </div>
              ))}
              {shown.length === 0 && <div className="empty-state"><Package size={22} /><p>{coupon && !debouncedQ ? t("لا طلبات بهذا الكود بعد.") : product && !debouncedQ ? t("لا طلبات بهذا المنتج بعد.") : debouncedQ ? t("لا توجد نتائج مطابقة للبحث.") : tab === "gifts" ? t("لا توجد طلبات ببطاقة هدية بعد — الحقل اختياري عند إتمام الشراء.") : t("لا توجد طلبات في هذا التصنيف.")}</p></div>}
            </>
          )}
        </div>
        {error && <div className="empty-state"><Package size={20} /><p>{error}</p></div>}
        <PaginationBar page={safePage} pages={pages} total={total} onPage={setPage} label="طلب" />
      </div>
    </div>
  );
}

// rows arrive fully server-paged — the table renders them as-is

// ─────────────────────────────────────────────────────────── Products
const PLACEHOLDER_IMAGE = "/images/p-beauty-box.webp";

function AddProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [draft, setDraft] = useState({ name: "", nameAr: "", category: "Makeup", price: "", stock: "", description: "", badgeAr: "" });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const t = useAdminT();
  const ar = useAdminAr();
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = uploading;
  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!list.length) return toast.error(t("اختاري صورًا صالحة (JPG, PNG, WEBP)"));
    const room = 5 - images.length;
    if (room <= 0) return toast.error(t("الحد الأقصى 5 صور للمنتج"));
    const toUpload = list.slice(0, room);
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of toUpload) {
        const compressed = await compressImage(file, 1600, 0.82);
        const fd = new FormData();
        fd.append("file", compressed);
        fd.append("altText", draft.nameAr || draft.name || file.name);
        const res = await api<{ url: string }>("/api/admin/media", { method: "POST", body: fd });
        urls.push(res.url);
      }
      setImages(prev => [...prev, ...urls]);
      toast.success(toUpload.length > 1 ? ar ? `تم رفع ${toUpload.length} صور` : `${toUpload.length} photos uploaded` : t("تم رفع الصورة"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("فشل رفع الصورة"));
    } finally {
      setUploading(false);
    }
  };
  const removeImage = (url: string) => setImages(prev => prev.filter(u => u !== url));
  const submit = async () => {
    if (!draft.name || !draft.price) return toast.error(t("أدخلي اسم المنتج والسعر أولاً"));
    try {
      await api("/api/admin/products", post("/api/admin/products", {
        slug: `product-${Date.now()}`,
        name: draft.name, nameAr: draft.nameAr || draft.name, category: draft.category, categoryAr: CATEGORY_LABELS_AR[draft.category] || draft.category,
        price: Number(draft.price), stock: Number(draft.stock || 0),
        description: draft.description || "منتج جديد في انتظار استكمال التفاصيل.",
        images: images.length ? images : [PLACEHOLDER_IMAGE], featured: false, visible: true, variants: [],
        badgeAr: draft.badgeAr || null, badge: draft.badgeAr || null,
      }));
      toast.success(images.length ? t("تم إنشاء المنتج بالصور المرفوعة") : t("تم إنشاء المنتج كمسودة"));
      onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الحفظ")); }
  };
  return (
    <div className="overlay">
      <div className="admin-modal">
        <div className="modal-head">
          <div><span className="eyebrow">PRODUCT / DRAFT</span><h2>{t("إضافة منتج جديد")}</h2></div>
          <button className="icon-button" onClick={onClose}><X size={19} /></button>
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
          <Upload size={24} className={uploading ? "spin" : ""} />
          <strong>{uploading ? t("جارٍ الرفع...") : dragOver ? t("أفلتي الصور هنا") : t("اسحبي الصور هنا أو اضغطي للاختيار")}</strong>
          <span>{t("JPG, PNG أو WEBP · حتى 5 صور · تُرفع إلى مكتبة الوسائط")}</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={e => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
        {images.length > 0 && (
          <div className="upload-thumbs" role="list" aria-label={t("صور المنتج")}>
            {images.map((url, i) => (
              <div className={`upload-thumb ${i === 0 ? "is-main" : ""}`} key={url} role="listitem">
                <img src={url} alt={`${t("صورة")} ${i + 1}`} loading="lazy" decoding="async" />
                {i === 0 && <em>{t("رئيسية")}</em>}
                <button type="button" onClick={() => removeImage(url)} aria-label={t("حذف الصورة")}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <label>{t("اسم المنتج (إنجليزي)")}<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Rose Mist" /></label>
        <label>{t("اسم المنتج (عربي)")}<input value={draft.nameAr} onChange={e => setDraft({ ...draft, nameAr: e.target.value })} placeholder="روز ميست" /></label>
        <div className="two-fields">
          <label>{t("القسم")}
            <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
              {Object.entries(CATEGORY_LABELS_AR).map(([en, arLabel]) => <option key={en} value={en}>{ar ? arLabel : en}</option>)}
            </select>
          </label>
          <label>{t("السعر")}<input type="number" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="400" /></label>
        </div>
        <div className="two-fields">
          <label>{t("المخزون")}<input type="number" value={draft.stock} onChange={e => setDraft({ ...draft, stock: e.target.value })} placeholder="20" /></label>
          <label>{t("شارة المنتج")}<input value={draft.badgeAr} onChange={e => setDraft({ ...draft, badgeAr: e.target.value })} placeholder="تحت 100 ج.م" /></label>
        </div>
        <label>{t("الوصف")}<textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder={t("وصف قصير يجذب العميل...")} /></label>
        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose}>{t("إلغاء")}</button>
          <button className="button button-dark" onClick={submit} disabled={busy}>{t("حفظ كمسودة")}<Check size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function ProductsSection({ products, reload, openAdd }: { products: Product[]; reload: () => void; openAdd: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const t = useAdminT();
  const ar = useAdminAr();
  const moneyFmt = useAdminMoney();
  const visible = products
    .filter(p => `${p.name} ${p.nameAr} ${p.categoryAr}`.toLowerCase().includes(query.toLowerCase()))
    .filter(p => status === "all" || (status === "live" ? p.visible !== false : p.visible === false));

  const patch = async (p: Product, changes: Partial<Product>) => {
    try {
      await api("/api/admin/products", post("/api/admin/products", {
        slug: p.id, name: p.name, nameAr: p.nameAr, category: p.category, categoryAr: p.categoryAr,
        price: changes.price ?? p.price, oldPrice: changes.oldPrice !== undefined ? changes.oldPrice : (p.oldPrice ?? null),
        description: p.description, images: p.images?.length ? p.images : [p.image], variants: p.variants || [],
        stock: changes.stock ?? p.stock, featured: changes.featured ?? !!p.featured,
        visible: changes.visible ?? p.visible !== false,
        badge: changes.badge !== undefined ? changes.badge : (p.badge ?? null),
        badgeAr: changes.badgeAr !== undefined ? changes.badgeAr : (p.badgeAr ?? null),
      }));
      toast.success(t("تم تحديث المنتج"));
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل التحديث")); }
  };

  // Full editor replaces the old window.prompt() flow: every field (identity,
  // pricing, images, variants, publishing) is editable from one form.
  const edit = (p: Product) => setEditingId(p.id);
  const editVariants = (p: Product) => setEditingId(p.id);
  const editingProduct = editingId ? products.find(p => p.id === editingId) || null : null;
  const removeProduct = async (p: Product) => {
    if (!window.confirm(ar ? `حذف المنتج "${p.nameAr}" نهائيًا؟` : `Delete the product "${p.name}" permanently?`)) return;
    try {
      await fetch(`/api/admin/products?slug=${encodeURIComponent(p.id)}`, { method: "DELETE" });
      toast.success(t("تم حذف المنتج"));
      reload();
    } catch { toast.error(t("فشل الحذف")); }
  };
  const importCsv = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const lines = String(reader.result || "").split(/\r?\n/).filter(Boolean);
      const rows = lines.slice(1).map(line => line.split(","));
      let count = 0;
      for (const row of rows) {
        if (!row[1]) continue;
        try {
          await api("/api/admin/products", post("/api/admin/products", {
            slug: row[0] || `csv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: row[1], nameAr: row[1], category: row[2] || "Makeup", categoryAr: CATEGORY_LABELS_AR[row[2]] || row[2] || "مكياج",
            price: Number(row[3] || 0), stock: Number(row[4] || 0), images: ["/images/p-beauty-box.webp"],
            description: "Imported from CSV", visible: row[5] !== "false", featured: row[6] === "true", variants: [],
          }));
          count++;
        } catch { /* skip bad row */ }
      }
      toast.success(`${t("تم استيراد")} ${count} ${t("منتجات")}`);
      reload();
    };
    reader.readAsText(file);
  };
  const exportCsv = () => {
    const csv = ["id,name,category,price,stock,visible,featured", ...products.map(p => [p.id, p.name, p.category, p.price, p.stock, p.visible !== false, !!p.featured].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "lubnel-products.csv"; a.click();
    toast.success(t("تم تصدير المنتجات"));
  };
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("المنتجات")} <small>{products.length}</small></h2><p>{t("إدارة الأسعار والمخزون والمتغيرات والصور المتعددة لكل منتج.")}</p></div>
        <button className="button button-dark" onClick={openAdd}><Plus size={16} /> {t("إضافة منتج")}</button>
      </div>
      <div className="product-toolbar">
        <div className="admin-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("ابحثي باسم المنتج أو التصنيف")} /></div>
        <button className={`tool-button ${status === "all" ? "active" : ""}`} onClick={() => setStatus("all")}><ListFilter size={16} /> {t("الكل")}</button>
        <button className={`tool-button ${status === "live" ? "active" : ""}`} onClick={() => setStatus("live")}>{t("منشور")}</button>
        <button className={`tool-button ${status === "hidden" ? "active" : ""}`} onClick={() => setStatus("hidden")}>{t("مخفي")}</button>
        <button className="tool-button" onClick={exportCsv}><Upload size={16} /> {t("تصدير CSV")}</button>
        <label className="tool-button import-button">{t("استيراد CSV")}<input type="file" accept=".csv,text/csv" onChange={e => importCsv(e.target.files?.[0])} /></label>
      </div>
      <div className="panel admin-products-panel">
        <div className="admin-table product-table">
          <div className="table-row table-label"><span>{t("المنتج")}</span><span>{t("القسم")}</span><span>{t("السعر")}</span><span>{t("المخزون")}</span><span>{t("الحالة")}</span><span /></div>
          {visible.map(p => (
            <div className={`table-row ${p.visible === false ? "row-muted" : ""}`} key={p.id}>
              <span className="product-cell">
                <img src={p.image} alt={p.alt} loading="lazy" decoding="async" />
                <span><strong>{ar ? p.nameAr : (p.name || p.nameAr)}</strong><small>{p.id.toUpperCase()} {p.featured ? t("· مميز") : ""} · {(p.variants || []).length} {t("متغيرات")}</small></span>
              </span>
              <span>{ar ? p.categoryAr : (p.category || p.categoryAr)}</span>
              <span>{moneyFmt(p.price)}{p.oldPrice && <del>{moneyFmt(p.oldPrice)}</del>}</span>
              <span className={p.stock < 10 ? "low-stock-text" : ""}>{p.stock} {t("قطعة")} <button className="inline-edit" onClick={() => edit(p)} title={t("تعديل كامل")}><Pencil size={11} /></button></span>
              <span><button className="status status-live" onClick={() => patch(p, { visible: p.visible === false })}>{p.visible === false ? t("مخفي") : t("منشور")}</button></span>
              <span className="row-actions">
                <button onClick={() => edit(p)} title={t("تعديل")}><Pencil size={15} /></button>
                <button onClick={() => editVariants(p)} title={t("المتغيرات")}><Tags size={14} /></button>
                <button onClick={() => patch(p, { featured: !p.featured })} title={t("تمييز")}><Star size={14} fill={p.featured ? "currentColor" : "none"} /></button>
                <button onClick={() => removeProduct(p)} title={t("حذف")}><Trash2 size={15} /></button>
              </span>
            </div>
          ))}
          {visible.length === 0 && <div className="empty-state"><Tags size={22} /><p>{t("لا توجد منتجات مطابقة.")}</p></div>}
        </div>
      </div>
      {editingProduct && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => setEditingId(null)}
          onSaved={() => reload()}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Coupons
function CouponsSection() {
  const [coupons, setCoupons] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", label: "", type: "percent", value: "20", minSubtotal: "0", maxDiscount: "", usageLimit: "", endsAt: "" });
  const t = useAdminT();
  const ar = useAdminAr();
  const moneyFmt = useAdminMoney();
  const load = useCallback(() => { api<{ coupons: Record<string, unknown>[] }>("/api/admin/coupons").then(d => setCoupons(d.coupons)).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  const create = async () => {
    if (!form.code.trim() || !form.value) return toast.error(t("أدخلي الكود وقيمة الخصم"));
    try {
      await api("/api/admin/coupons", post("/api/admin/coupons", {
        action: "create", code: form.code, label: form.label || undefined, type: form.type,
        value: Number(form.value), minSubtotal: Number(form.minSubtotal || 0),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null, active: true,
      }));
      toast.success(t("تم إنشاء الكوبون"));
      setShowForm(false);
      setForm({ code: "", label: "", type: "percent", value: "20", minSubtotal: "0", maxDiscount: "", usageLimit: "", endsAt: "" });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الإنشاء")); }
  };
  const remove = async (id: number) => {
    try { await api("/api/admin/coupons", post("/api/admin/coupons", { action: "remove", id })); toast.success(t("تم تعطيل الكوبون")); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("فشل التعطيل")); }
  };
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("الكوبونات والخصومات")} <small>{coupons.length}</small></h2><p>{t("أنشئي أكواد خصم بنسبة أو قيمة ثابتة، مع حدود استخدام وسقف خصم.")}</p></div>
        <button className="button button-dark" onClick={() => setShowForm(!showForm)}><Plus size={16} /> {t("كوبون جديد")}</button>
      </div>
      {showForm && (
        <div className="panel coupon-form">
          <div className="two-fields">
            <label>{t("الكود")}<input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="GLOW20" /></label>
            <label>{t("الوصف")}<input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="خصم 20٪ للطلبات فوق 500" /></label>
          </div>
          <div className="two-fields">
            <label>{t("النوع")}
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="percent">{t("نسبة ٪")}</option><option value="fixed">{t("قيمة ثابتة ج.م")}</option></select>
            </label>
            <label>{t("القيمة")}<input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></label>
          </div>
          <div className="two-fields">
            <label>{t("الحد الأدنى للطلب")}<input type="number" value={form.minSubtotal} onChange={e => setForm({ ...form, minSubtotal: e.target.value })} /></label>
            <label>{t("أقصى خصم (اختياري)")}<input type="number" value={form.maxDiscount} onChange={e => setForm({ ...form, maxDiscount: e.target.value })} /></label>
          </div>
          <div className="two-fields">
            <label>{t("حد الاستخدام (اختياري)")}<input type="number" value={form.usageLimit} onChange={e => setForm({ ...form, usageLimit: e.target.value })} placeholder={t("مثال: 30")} /></label>
            <label>{t("تاريخ الانتهاء (اختياري)")}<input type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} /></label>
          </div>
          <p className="form-hint">{t("الكوبونات المنتهية أو التي استهلكت حد استخدامها تختفي تلقائيًا من شريط العروض في الواجهة.")}</p>
          <div className="modal-actions">
            <button className="button button-dark" onClick={create}><Check size={16} /> {t("إنشاء الكوبون")}</button>
          </div>
        </div>
      )}
      <div className="panel admin-coupons-panel">
        <div className="admin-table">
          <div className="table-row table-label"><span>{t("الكود")}</span><span>{t("الوصف")}</span><span>{t("القيمة")}</span><span>{t("الحد الأدنى")}</span><span>{t("الاستخدام")}</span><span>{t("الانتهاء")}</span><span>{t("الحالة")}</span><span /></div>
          {coupons.map(c => {
            const endsAt = c.endsAt as string | null;
            const expDays = endsAt ? Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000) : null;
            return (
              <div className={`table-row ${c.active ? "" : "row-muted"}`} key={String(c.id)}>
                <span className="order-id">{String(c.code)}</span>
                <span>{(c.label as string) || "—"}</span>
                <span>{c.type === "percent" ? `${c.value}٪` : moneyFmt(Number(c.value))}</span>
                <span>{Number(c.minSubtotal) ? moneyFmt(Number(c.minSubtotal)) : "—"}</span>
                <span>{Number(c.usageCount)}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</span>
                <span>{endsAt ? <em className={`expiry-chip ${expDays !== null && expDays <= 1 ? "expiry-hot" : ""}`}>{expDays !== null && expDays <= 0 ? t("ينتهي اليوم") : ar ? `بعد ${expDays} يوم` : `in ${expDays} ${expDays === 1 ? "day" : "days"}`}</em> : "—"}</span>
                <span><em className={`status ${c.active ? "status-live" : "status-cancelled"}`}>{c.active ? t("نشط") : t("معطل")}</em></span>
                <span className="row-actions">
                  {Boolean(c.active) && <button onClick={() => remove(Number(c.id))} title={t("تعطيل")}><Trash2 size={15} /></button>}
                </span>
              </div>
            );
          })}
          {coupons.length === 0 && <div className="empty-state"><Tags size={22} /><p>{t("لا توجد كوبونات بعد.")}</p></div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Categories
function CategoriesSection() {
  const [cats, setCats] = useState<{ id: number; slug: string; name: string; nameAr: string; imageUrl: string; count: number; visible: boolean }[]>([]);
  const t = useAdminT();
  const ar = useAdminAr();
  const load = useCallback(() => { api<{ categories: typeof cats }>("/api/admin/categories").then(d => setCats(d.categories)).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    const label = window.prompt(t("اسم الفئة بالعربية"));
    if (!label) return;
    try {
      await api("/api/admin/categories", post("/api/admin/categories", { action: "create", name: label, nameAr: label }));
      toast.success(t("تمت إضافة الفئة")); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الإضافة")); }
  };
  const update = async (c: typeof cats[number], patch: Record<string, unknown>) => {
    try { await api("/api/admin/categories", post("/api/admin/categories", { action: "update", id: c.id, ...patch })); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("فشل التعديل")); }
  };
  const remove = async (c: typeof cats[number]) => {
    if (!window.confirm(ar ? `حذف فئة "${c.nameAr}"؟` : `Delete the "${c.name}" category?`)) return;
    try { await fetch(`/api/admin/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", id: c.id }) }); toast.success(t("تم الحذف")); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الحذف")); }
  };
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("الفئات")} <small>{cats.length}</small></h2><p>{t("أضيفي، عدّلي أو أخفي الفئات بدون حذفها.")}</p></div>
        <button className="button button-dark" onClick={add}><Plus size={16} /> {t("إضافة فئة")}</button>
      </div>
      <div className="admin-category-grid">
        {cats.map((c, i) => (
          <div className={`admin-category-card ${c.visible ? "" : "category-hidden"}`} key={c.id}>
            <img src={c.imageUrl} alt={c.nameAr} loading="lazy" decoding="async" />
            <div>
              <span>0{i + 1} / {c.count} {t("منتج")}</span>
              <h3>{ar ? c.nameAr : (c.name || c.nameAr)}</h3>
              <button onClick={() => { const next = window.prompt(t("تعديل اسم الفئة"), ar ? c.nameAr : c.name); if (next) update(c, { nameAr: next, name: next }); }}>{t("تعديل")} <Pencil size={13} /></button>
              <div className="category-actions">
                <button onClick={() => update(c, { visible: !c.visible })}>{c.visible ? t("إخفاء") : t("إظهار")}</button>
                <button onClick={() => remove(c)}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Media
type MediaAsset = { id: number; url: string; fileName: string; altText: string | null; mimeType: string | null; createdAt: string };
function MediaSection() {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState<"cover" | "contain">("cover");
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useAdminT();
  const ar = useAdminAr();
  const load = useCallback(() => { api<{ media: MediaAsset[] }>("/api/admin/media").then(d => setMedia(d.media)).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file, 1800, 0.82);
        const form = new FormData();
        form.append("file", compressed);
        form.append("altText", compressed.name.replace(/\.[^/.]+$/, ""));
        form.append("crop", crop);
        await api("/api/admin/media", { method: "POST", body: form });
        toast.success(ar ? `تم رفع ${compressed.name}${compressed.size < file.size ? ` (ضُغطت من ${(file.size / 1024 / 1024).toFixed(1)}MB إلى ${(compressed.size / 1024 / 1024).toFixed(1)}MB)` : ""}` : `${compressed.name} uploaded${compressed.size < file.size ? ` (compressed from ${(file.size / 1024 / 1024).toFixed(1)}MB to ${(compressed.size / 1024 / 1024).toFixed(1)}MB)` : ""}`);
      } catch (e) { toast.error(e instanceof Error ? e.message : `${t("تعذر رفع")} ${file.name}`); }
    }
    load();
  };
  const remove = async (id: number) => {
    try { await fetch(`/api/admin/media?id=${id}`, { method: "DELETE" }); load(); } catch { /* ignore */ }
  };
  const shown = media.filter(m => `${m.fileName} ${m.altText}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("مكتبة الصور")} <small>{media.length}</small></h2><p>{t("ارفعي صور المنتجات والحملات، وستظهر فورًا للعرض أو النسخ كروابط.")}</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={crop} onChange={e => setCrop(e.target.value as "cover" | "contain")} className="tool-button" aria-label="crop mode">
            <option value="cover">Cover</option><option value="contain">Contain</option>
          </select>
          <label className="tool-button import-button" style={{ cursor: "pointer" }}>
            <Upload size={16} /> {t("رفع صور")}
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { void upload(e.target.files); e.currentTarget.value = ""; }} />
          </label>
        </div>
      </div>
      <div className="product-toolbar">
        <div className="admin-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("ابحثي باسم الملف أو الوصف")} /></div>
      </div>
      <div className="media-grid">
        {shown.map(m => (
          <div className="media-card" key={m.id}>
            <img src={m.url} alt={m.altText || m.fileName} loading="lazy" />
            <div className="media-info"><strong>{m.fileName}</strong><small>{m.altText || "—"}</small></div>
            <div className="media-actions">
              <button onClick={() => { const done = () => toast.success(t("تم نسخ الرابط")); if (navigator.clipboard?.writeText) navigator.clipboard.writeText(m.url).then(done).catch(done); else done(); }} title={t("نسخ الرابط")}><ImageIcon size={14} /></button>
              <button onClick={() => remove(m.id)} title={t("حذف")}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="empty-state"><ImageIcon size={24} /><p>{t("لا توجد صور بعد — ابدئي برفع أول صورة.")}</p></div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Homepage hero
function HomepageSection() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [selected, setSelected] = useState<string>("");
  const t = useAdminT();
  const ar = useAdminAr();
  const load = useCallback(() => {
    api<{ slides: HeroSlide[] }>("/api/admin/slides").then(d => {
      setSlides(d.slides);
      setSelected(current => current || d.slides[0]?.id || "");
    }).catch(() => undefined);
  }, []);
  useEffect(() => { load(); }, [load]);
  const current = slides.find(s => s.id === selected);
  const update = (patch: Partial<HeroSlide>) => current && setSlides(slides.map(s => s.id === current.id ? { ...s, ...patch } : s));
  const save = async () => {
    if (!current) return;
    try {
      await api("/api/admin/slides", post("/api/admin/slides", current));
      toast.success(t("تم حفظ الشريحة وتحديث الواجهة"));
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الحفظ")); }
  };
  const add = async () => {
    const id = `slide-${Date.now()}`;
    try {
      await api("/api/admin/slides", post("/api/admin/slides", {
        id, eyebrow: "LUBNÉL / NEW", titleAr: "شريحة جديدة\nمن LUBNÉL.", titleEn: "A new\nLUBNÉL slide.",
        bodyAr: "نص تعريفي قصير للشريحة الجديدة.", bodyEn: "A short intro copy for the new slide.",
        image: "/images/hero-1.webp", active: false, sortOrder: slides.length + 1,
      }));
      toast.success(t("تمت إضافة شريحة جديدة")); load(); setSelected(id);
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الإضافة")); }
  };
  const remove = async () => {
    if (!current || slides.length <= 1) return;
    try {
      await api("/api/admin/slides", post("/api/admin/slides", { action: "remove", id: current.id }));
      toast.success(t("تم حذف الشريحة")); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الحذف")); }
  };
  const uploadImage = async (file: File | undefined) => {
    if (!file || !current) return;
    try {
      const compressed = await compressImage(file, 1344, 0.84);
      const form = new FormData();
      form.append("file", compressed);
      form.append("altText", current.titleAr.replace("\n", " "));
      const data = await api<{ url: string }>("/api/admin/media", { method: "POST", body: form });
      update({ image: data.url });
      toast.success(t("تم رفع صورة الشريحة"));
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الرفع")); }
  };
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("الصفحة الرئيسية")} <small>{slides.length} {t("شرائح")}</small></h2><p>{t("تحكمي كامل في شرائح الهيرو: النصوص، الصورة، الترتيب والتفعيل.")}</p></div>
        <button className="button button-dark" onClick={add}><Plus size={16} /> {t("شريحة جديدة")}</button>
      </div>
      <div className="homepage-editor">
        <div className="slide-list panel">
          {slides.map(s => (
            <button key={s.id} className={`slide-row ${s.id === selected ? "active" : ""}`} onClick={() => setSelected(s.id)}>
              <img src={s.image} alt="" loading="lazy" decoding="async" />
              <span>{ar ? s.titleAr.replace("\n", " ") : (s.titleEn || s.titleAr.replace("\n", " "))}</span>
              <em className={`status ${s.active ? "status-live" : "status-cancelled"}`}>{s.active ? t("مفعلة") : t("متوقفة")}</em>
            </button>
          ))}
        </div>
        {current && (
          <div className="panel slide-editor">
            <div className="panel-head">
              <div><h3>{t("تحرير الشريحة")}</h3><span>{current.id}</span></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="tool-button" onClick={remove}><Trash2 size={14} /> {t("حذف")}</button>
                <button className="button button-dark" onClick={save}><Check size={15} /> {t("حفظ")}</button>
              </div>
            </div>
            <label>{t("النص التمهيدي")}<input value={current.eyebrow} onChange={e => update({ eyebrow: e.target.value })} /></label>
            <label>{t("العنوان (عربي — استخدمي سطرًا جديدًا للتفريق)")}<textarea rows={2} value={current.titleAr} onChange={e => update({ titleAr: e.target.value })} /></label>
            <label>{t("العنوان (إنجليزي)")}<textarea rows={2} value={current.titleEn} onChange={e => update({ titleEn: e.target.value })} /></label>
            <div className="two-fields">
              <label>{t("الوصف (عربي)")}<textarea rows={2} value={current.bodyAr} onChange={e => update({ bodyAr: e.target.value })} /></label>
              <label>{t("الوصف (إنجليزي)")}<textarea rows={2} value={current.bodyEn} onChange={e => update({ bodyEn: e.target.value })} /></label>
            </div>
            <div className="two-fields">
              <label>{t("زر CTA (عربي)")}<input value={current.ctaAr} onChange={e => update({ ctaAr: e.target.value })} /></label>
              <label>{t("زر CTA (إنجليزي)")}<input value={current.ctaEn} onChange={e => update({ ctaEn: e.target.value })} /></label>
            </div>
            <div className="two-fields">
              <label>{t("صورة الشريحة")}<input value={current.image} onChange={e => update({ image: e.target.value })} /></label>
              <label>{t("رفع صورة جديدة")}<input type="file" accept="image/*" onChange={e => { void uploadImage(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label>
            </div>
            <label className="filter-check availability-check" style={{ marginTop: 10 }}>
              <span>{current.active ? <Check size={12} /> : null}</span>
              <input type="checkbox" checked={current.active} onChange={e => update({ active: e.target.checked })} />
              {t("الشريحة مفعلة في الواجهة")}
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Analytics
// Server renders day labels ar-EG; map the 7 weekday names for the EN studio.
const DAY_LABEL_EN: Record<string, string> = {
  "الجمعة": "Fri", "السبت": "Sat", "الأحد": "Sun", "الاثنين": "Mon", "الثلاثاء": "Tue", "الأربعاء": "Wed", "الخميس": "Thu",
};
function AnalyticsSection({ orders, products, onOpenGifts, onOpenCouponOrders, onOpenProductOrders, onOpenSourceOrders, initialOpenCode }: { orders: OrderRecord[]; products: Product[]; onOpenGifts: () => void; onOpenCouponOrders: (code: string) => void; onOpenProductOrders: (slug: string, name: string, code: string) => void; onOpenSourceOrders: (source: "coupon" | "rail" | "organic", days?: number) => void; initialOpenCode?: string }) {
  const [stats, setStats] = useState<{ totals: Record<string, number>; statusCounts: Record<string, number>; days: { label: string; total: number; netTotal?: number; count: number }[]; shareDays?: { date: string; label: string; count: number }[]; shareWeek?: { slug: string; nameAr: string; count: number; prev: number }[]; shareCampaigns?: { id: string; titleAr: string; titleEn: string; image: string; total: number; week: number; prev: number }[]; topCustomers?: { name: string; phone: string; count: number; total: number; last: string }[]; bestSellers?: { slug: string; nameAr: string; name: string; image: string; qty: number; revenue: number }[]; bestSellersWeek?: { slug: string; nameAr: string; name: string; image: string; qty: number; revenue: number }[]; ordersByHour?: number[]; giftRateTrend?: { date: string; gift: number; orders: number; rate: number }[]; repeat30?: { total: number; repeat: number; rate: number }; couponPerf?: CouponPerfRow[]; couponPerfEff?: CouponPerfRow[]; couponItems?: CouponItemsGroup[]; topWished?: WishRow[]; railPulls?: { slug: string; count: number }[]; railConversions?: number; railSold?: { slug: string; count: number }[]; railBoard?: RailBoardRow[]; orderMix?: { net: number; coupon: number; rail: number; both: number; organic: number }; mixTrend?: MixTrend; wishAdds?: number; wishTrend?: { date: string; adds: number }[]; wishAddsWeek?: number; wishAddsPrevWeek?: number } | null>(null);
  useEffect(() => { api<{ totals: Record<string, number>; statusCounts: Record<string, number>; days: { label: string; total: number; netTotal?: number; count: number }[]; shareDays?: { date: string; label: string; count: number }[]; shareWeek?: { slug: string; nameAr: string; count: number; prev: number }[]; shareCampaigns?: { id: string; titleAr: string; titleEn: string; image: string; total: number; week: number; prev: number }[]; topCustomers?: { name: string; phone: string; count: number; total: number; last: string }[]; bestSellers?: { slug: string; nameAr: string; name: string; image: string; qty: number; revenue: number }[]; bestSellersWeek?: { slug: string; nameAr: string; name: string; image: string; qty: number; revenue: number }[]; ordersByHour?: number[]; giftRateTrend?: { date: string; gift: number; orders: number; rate: number }[]; repeat30?: { total: number; repeat: number; rate: number }; couponPerf?: CouponPerfRow[]; couponPerfEff?: CouponPerfRow[]; couponItems?: CouponItemsGroup[]; topWished?: WishRow[]; railPulls?: { slug: string; count: number }[]; railConversions?: number; railSold?: { slug: string; count: number }[]; railBoard?: RailBoardRow[]; orderMix?: { net: number; coupon: number; rail: number; both: number; organic: number }; mixTrend?: MixTrend; wishAdds?: number; wishTrend?: { date: string; adds: number }[]; wishAddsWeek?: number; wishAddsPrevWeek?: number }>("/api/admin/stats").then(setStats).catch(() => undefined); }, []);
  // R28 — gross/net view toggle, remembered per admin (localStorage)
  const [netMode, setNetMode] = useState(() => { try { return localStorage.getItem("lubnel-analytics-net") === "1"; } catch { return false; } });
  const switchNet = (v: boolean) => { setNetMode(v); try { localStorage.setItem("lubnel-analytics-net", v ? "1" : "0"); } catch { /* private mode */ } };
  // Server truth (stats.totals) first — the client orders array is capped, so
  // beyond-300 stores would silently undercount if we summed locally.
  const revenue = stats?.totals.revenue ?? orders.reduce((sum, order) => sum + order.total, 0);
  const orderCount = stats?.totals.orders ?? orders.length;
  // R28 — net view (cancelled excluded); falls back to gross until stats settle
  const netRevenue = stats?.totals.netRevenue ?? revenue;
  const netOrders = stats?.totals.netOrders ?? (stats?.totals.orders ?? orders.length);
  const shownRevenue = netMode ? netRevenue : revenue;
  const shownAverage = netMode ? (stats?.totals.netAverage ?? (netOrders ? Math.round(netRevenue / netOrders) : 0)) : (stats?.totals.average ?? (orderCount ? Math.round(revenue / orderCount) : 0));
  const completed = stats?.totals.completed ?? orders.filter(o => ["completed", "shipped"].includes(o.status)).length;
  const average = stats?.totals.average ?? (orderCount ? Math.round(revenue / orderCount) : 0);
  // R27 — exact over full history (SQL groupBy), so the cancelled bar is trustworthy
  const cancelled = stats?.totals.cancelled ?? orders.filter(o => o.status === "cancelled").length;
  const cancelRate = orderCount ? Math.round((cancelled / orderCount) * 100) : 0;
  // R34 — weekly gift-adoption rate (0 until stats settle; ring reads this)
  const giftRateWeek = stats?.totals.giftRateWeek ?? 0;
  const lowStock = products.filter(p => p.stock < 10).length;
  // R28 — the 7-day chart follows the active gross/net view
  const dayValue = (d: { total: number; netTotal?: number }) => (netMode ? (d.netTotal ?? d.total) : d.total);
  const maxDay = Math.max(1, ...(stats?.days || []).map(dayValue));
  const shareDayList = stats?.shareDays || [];
  const maxShareDay = Math.max(1, ...shareDayList.map(d => d.count));
  const totalShares14 = shareDayList.reduce((s, d) => s + d.count, 0);
  // slug → this-week/last-week share tally, surfaced as delta chips on the leaderboard
  const weekly = Object.fromEntries((stats?.shareWeek || []).map(w => [w.slug, { count: w.count, prev: w.prev }]));
  const t = useAdminT();
  const ar = useAdminAr();
  const moneyFmt = useAdminMoney();
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("التحليلات")}</h2><p>{t("أرقام محسوبة من الطلبات المسجلة والكتالوج الحالي.")}</p></div>
        <div className="content-head-actions">
          <div className="net-toggle" role="group" aria-label={t("نطاق الإيراد")}>
            <button type="button" className={netMode ? "" : "on"} aria-pressed={!netMode} onClick={() => switchNet(false)}>{t("الإيراد الإجمالي")}</button>
            <button type="button" className={netMode ? "on" : ""} aria-pressed={netMode} onClick={() => switchNet(true)}>{t("الإيراد الصافي")}</button>
          </div>
          <button className="tool-button" onClick={() => window.location.reload()}><TrendingUp size={16} /> {t("تحديث البيانات")}</button>
        </div>
      </div>
      <div className="analytics-cards">
        <div className="panel"><span>{t("إجمالي الطلبات")}</span><strong>{orderCount}</strong><small>{t("من الطلبات الفعلية")}</small></div>
        <div className="panel"><span>{t(netMode ? "صافي المبيعات" : "إجمالي المبيعات")}</span><strong>{moneyFmt(shownRevenue)}</strong><small className={netMode ? "net-note" : "positive"}>{t(netMode ? "باستثناء الطلبات الملغاة" : "الطلبات المسجلة")}</small></div>
        <div className="panel"><span>{t("متوسط قيمة الطلب")}</span><strong>{moneyFmt(shownAverage)}</strong><small>{t(netMode ? "لكل طلب بعد الإلغاء" : "لكل طلب")}</small></div>
        <div className="panel"><span>{t("منخفض المخزون")}</span><strong>{lowStock}</strong><small className="negative">{t("يحتاج متابعة")}</small></div>
      </div>
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("المبيعات آخر 7 أيام")}</h3><span>{t(netMode ? "باستثناء الطلبات الملغاة" : "محسوبة من تاريخ الطلب")}</span></div></div>
        <div className="week-bars">
          {(stats?.days || []).map((d, i) => (
            <div key={i} className="week-bar">
              <div className="bar-zone">
                <i style={{ height: `${Math.max(6, (dayValue(d) / maxDay) * 100)}%` }} />
                <b>{dayValue(d) ? `${(dayValue(d) / 1000).toFixed(1)}K` : ""}</b>
              </div>
              <span>{ar ? d.label : (DAY_LABEL_EN[d.label] || d.label)}</span>
            </div>
          ))}
          {!stats && <div className="empty-state"><BarChart3 size={22} /><p>{t("لا توجد بيانات كافية بعد.")}</p></div>}
        </div>
      </div>
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("حالة الطلبات")}</h3><span>{t("بيانات الطلبات الحالية")}</span></div></div>
        <div className="funnel">
          <div style={{ width: "100%" }}><span>{t("كل الطلبات")}</span><b>{orderCount}</b></div>
          <div style={{ width: `${orderCount ? Math.max(18, (completed / orderCount) * 100) : 18}%` }}><span>{t("مكتملة")}</span><b>{completed}</b></div>
          <div style={{ width: `${orderCount ? Math.max(12, ((stats?.statusCounts?.new || orders.filter(o => o.status === "new").length) / orderCount) * 100) : 12}%` }}><span>{t("جديدة")}</span><b>{stats?.statusCounts?.new ?? orders.filter(o => o.status === "new").length}</b></div>
          {cancelled > 0 && (
            <div className="neg" style={{ width: `${Math.max(12, (cancelled / orderCount) * 100)}%` }}><span>{t("ملغاة")} · {cancelRate}%</span><b>{cancelled}</b></div>
          )}
        </div>
      </div>
      {/* R34 — gift adoption pulse: weekly rate ring + week-over-week delta,
          closing the measurement loop the R33 cart nudge opened. Click-through
          lands in the gift office view (same jump as the R32 overview chip). */}
      <div className="panel analytics-chart gift-rate-panel">
        <div className="panel-head"><div><h3>{t("نبض الهدايا · آخر 7 أيام")}</h3><span>{t("نسبة الطلبات التي حملت بطاقة هدية — مقياس أثر التذكير داخل السلة")}</span></div></div>
        <div className="gift-rate-body">
          <div
            className="gift-ring"
            style={{ "--p": giftRateWeek } as CSSProperties}
            role="img"
            aria-label={ar ? `${giftRateWeek} بالمئة من طلبات هذا الأسبوع حملت بطاقة هدية` : `${giftRateWeek} percent of this week's orders carried a gift card`}
          >
            <b>{giftRateWeek}%</b>
            <span>{t("من الطلبات")}</span>
          </div>
          <div className="gift-rate-meta">
            <p>{(() => {
              const gw = stats?.totals.giftOrdersWeek ?? 0;
              const ow = stats?.totals.ordersWeek ?? 0;
              if (!ow) return ar ? "لا طلبات هذا الأسبوع بعد — سيُقاس معدل الهدايا مع أول طلب." : "No orders this week yet — the gift rate is measured from the first order.";
              return ar
                ? `${gw} من ${ow} طلبات هذا الأسبوع حملت بطاقة هدية`
                : `${gw} of ${ow} order${ow === 1 ? "" : "s"} this week carried a gift card`;
            })()}</p>
            {(() => {
              const cur = stats?.totals.giftRateWeek;
              const prev = stats?.totals.giftRatePrevWeek;
              if (cur == null || prev == null) return null;
              const delta = cur - prev;
              if (delta === 0) return <span className="gift-rate-delta flat" title={t("مستقر مقارنة بالأسبوع الماضي")}>— {t("مستقر مقارنة بالأسبوع الماضي")} ({prev}%)</span>;
              return (
                <span
                  className={`gift-rate-delta ${delta > 0 ? "up" : "down"}`}
                  title={delta > 0 ? t("ارتفاع مقارنة بالأسبوع الماضي") : t("انخفاض مقارنة بالأسبوع الماضي")}
                >
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} {t("نقطة مقارنة بالأسبوع الماضي")} ({prev}%)
                </span>
              );
            })()}
            <button type="button" className="gift-rate-link" onClick={onOpenGifts}>
              {t("عرض طلبات الهدايا")} <ArrowLeft size={13} aria-hidden />
            </button>
          </div>
        </div>
        {/* R37 — daily rate sparkline: week-over-week delta shows the trend,
            these 7 points show WHERE in the week it moved (oldest→newest,
            same flow as the sales bars above). Hidden on a zero-order week. */}
        {stats?.giftRateTrend && (stats.totals.ordersWeek ?? 0) > 0 && (() => {
          const trend = stats.giftRateTrend;
          const maxRate = Math.max(1, ...trend.map(p => p.rate));
          return (
            <div className="gift-spark-wrap">
              <span className="gift-spark-cap">{t("المعدل اليومي")}</span>
              <div className="gift-spark" role="img" aria-label={ar ? "المعدل اليومي لبطاقات الهدايا خلال آخر 7 أيام" : "Daily gift-card rate over the last 7 days"}>
                {trend.map((p, i) => (
                  <span
                    className="gift-spark-col"
                    key={p.date}
                    title={ar
                      ? `${new Date(p.date + "T00:00:00").toLocaleDateString("ar-EG", { weekday: "long" })} · ${p.rate}% (${p.gift} من ${p.orders})`
                      : `${new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" })} · ${p.rate}% (${p.gift} of ${p.orders})`}
                    style={{ "--i": i } as CSSProperties}
                  >
                    <i className={p.rate > 0 ? "" : "empty"} style={{ height: `${p.rate > 0 ? Math.max(14, (p.rate / maxRate) * 100) : 8}%` }} />
                  </span>
                ))}
              </div>
            </div>
          );
})()}
      </div>
      {/* R35 — best sellers by units sold (SQL json_each over all orders) */}
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("الأكثر بيعًا")}</h3><span>{t("حسب الكمية المباعة في الطلبات غير الملغاة")}</span></div></div>
        <BestSellers stats={stats} orders={orders} products={products} />
      </div>
      {/* R40 — wishlist demand: most-saved products vs their actual sold units */}
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("أكثر المنتجات إضافةً للمفضلة")}</h3><span>{t("إشارات طلب قبل الشراء — الأمنيات مقابل المبيعات")}</span></div></div>
        <WishPanel stats={stats} onOpenProductOrders={onOpenProductOrders} />
      </div>
      {/* R50 — rail leaderboard: what the cross-sell rail pulled (clicks vs orders) */}
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("أداء الريل")}</h3><span>{t("ما جذبه ريل المقترحات — النقرات مقابل الطلبات مقابل إيرادها")}</span></div></div>
        <RailBoard stats={stats} />
      </div>
      {/* R51/R52 — order mix: coupon vs rail vs organic over non-cancelled orders;
          the legend chips are the drill — click one to land in the orders view
          filtered to that exact source (same classification, same numbers) */}
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("مزيج الطلبات")}</h3><span>{t("من أين جاءت الطلبات غير الملغاة — كوبونات أم ريل أم حركة طبيعية")}</span></div></div>
        <OrderMix stats={stats} onOpenSource={onOpenSourceOrders} />
      </div>
      {/* R38 — coupon performance: which discount codes actually redeem */}
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("أداء الكوبونات")}</h3><span>{t("حسب الطلبات غير الملغاة التي استخدمت كود خصم")}</span></div></div>
        <CouponPerf stats={stats} orders={orders} onOpenOrders={onOpenCouponOrders} onOpenProductOrders={onOpenProductOrders} initialOpenCode={initialOpenCode} />
      </div>
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("أعلى العملاء")}</h3><span>{t("تجميع تلقائي حسب رقم الهاتف")}</span></div></div>
        <TopCustomers customers={stats?.topCustomers} orders={orders} />
      </div>
      {/* R37 — repeat-purchase rate: the "who comes back" KPI (30-day window) */}
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("معدل تكرار الشراء")}</h3><span>{t("عملاء رجعوا للشراء خلال آخر 30 يومًا")}</span></div></div>
        <RepeatRate stats={stats} orders={orders} />
      </div>
      {/* R36 — hour-of-day histogram: WHEN orders land in a 30-day window */}
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("أوقات الذروة")}</h3><span>{t("توزيع الطلبات على ساعات اليوم — آخر 30 يومًا")}</span></div></div>
        <PeakHours stats={stats} orders={orders} />
      </div>
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("نبض المشاركات · آخر 14 يومًا")}</h3><span>{totalShares14 > 0 ? ar ? `إجمالي ${totalShares14} مشاركة عبر واتساب/فيسبوك/إكس/نسخ الرابط` : `${totalShares14} shares across WhatsApp/Facebook/X/copy-link` : t("لا مشاركات مسجّلة في نافذة الأسبوعين")}</span></div></div>
        <div className="share-spark" role="img" aria-label="Share activity, last 14 days">
          {shareDayList.map(d => (
            <div className="spark-col" key={d.date}>
              <span className="spark-tip" aria-hidden>{ar ? `${d.label} · ${d.count} ${t("مشاركة")}` : `${new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${d.count} shares`}</span>
              <i className={d.count ? "" : "empty"} style={{ height: `${Math.max(6, (d.count / maxShareDay) * 100)}%` }} />
            </div>
          ))}
          {shareDayList.length === 0 && <div className="empty-state"><Share2 size={22} /><p>{t("ستظهر مشاركات الزوارات هنا يوميًا.")}</p></div>}
        </div>
      </div>
      <div className="panel analytics-chart">
        <div className="panel-head"><div><h3>{t("الأكثر مشاركة")}</h3><span>{t("الأعلى مشاركة تراكميًا — مع حركة الأسبوع الحالي مقارنة بالسابق")}</span></div></div>
        <MostShared products={products} weekly={weekly} campaigns={stats?.shareCampaigns} />
      </div>
    </div>
  );
}

function TopCustomers({ customers, orders }: { customers?: { name: string; phone: string; count: number; total: number; last: string }[]; orders: OrderRecord[] }) {
  const t = useAdminT();
  const moneyFmt = useAdminMoney();
  const dateLocale = useAdminDateLocale();
  // Server-computed list is primary; client-side grouping stays as a fallback
  // for the brief moment before /api/admin/stats settles.
  let top = customers;
  if (!top) {
    const groups = new Map<string, { name: string; phone: string; count: number; total: number; last: string }>();
    for (const o of orders) {
      const key = o.customerPhone;
      const current = groups.get(key) || { name: o.customerName, phone: key, count: 0, total: 0, last: o.createdAt };
      current.count += 1;
      current.total += o.total;
      if (new Date(o.createdAt) > new Date(current.last)) { current.last = o.createdAt; current.name = o.customerName; }
      groups.set(key, current);
    }
    top = [...groups.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  }
  if (!top.length) return <div className="empty-state"><Users size={22} /><p>{t("لا يوجد عملاء بعد — أول طلب سيظهر هنا.")}</p></div>;
  return (
    <div className="admin-table">
      <div className="table-row table-label"><span>{t("العميل")}</span><span>{t("الهاتف")}</span><span>{t("الطلبات")}</span><span>{t("إجمالي الشراء")}</span><span>{t("آخر طلب")}</span></div>
      {top.map(c => (
        <div className="table-row" key={c.phone}>
          <span className="customer-cell"><span className="customer-avatar">{c.name[0]}</span>{c.name}</span>
          <span className="phone-num" dir="ltr">{formatEgyptPhone(c.phone)}</span>
          <span>{c.count}</span>
          <span><b>{moneyFmt(c.total)}</b></span>
          <span>{new Date(c.last).toLocaleDateString(dateLocale)}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────── Best sellers (R35, R36 toggle)
// Server json_each aggregation is primary truth (uncapped, full history); the
// client fallback parses the (capped) orders array only so the panel isn't
// blank during the brief stats load. Images resolve from the catalog; products
// deleted from it fall back to the item name the customer saw at checkout.
// R36 — segmented window toggle: all-time leaderboard vs the last-7-days
// trend slice (server bestSellersWeek; fallback applies the window locally).
// The toggle stays mounted in the empty state so switching back is one click.
function BestSellers({ stats, orders, products }: { stats: { bestSellers?: { slug: string; nameAr: string; name: string; image: string; qty: number; revenue: number }[]; bestSellersWeek?: { slug: string; nameAr: string; name: string; image: string; qty: number; revenue: number }[] } | null; orders: OrderRecord[]; products: Product[] }) {
  const t = useAdminT();
  const ar = useAdminAr();
  const moneyFmt = useAdminMoney();
  const [win, setWin] = useState<"all" | "week">("all");
  let top: { slug: string; label: string; image: string; qty: number; revenue: number }[] | null = null;
  if (win === "week") {
    if (stats) {
      top = (stats.bestSellersWeek || []).map(b => ({ slug: b.slug, label: ar ? b.nameAr : (b.name || b.nameAr), image: b.image, qty: b.qty, revenue: b.revenue }));
    } else if (orders.length) {
      top = bestFallback(orders, products, true);
    }
  } else if (stats?.bestSellers) {
    top = stats.bestSellers.map(b => ({ slug: b.slug, label: ar ? b.nameAr : (b.name || b.nameAr), image: b.image, qty: b.qty, revenue: b.revenue }));
  } else if (orders.length) {
    top = bestFallback(orders, products, false);
  }
  const max = Math.max(1, ...(top || []).map(r => r.qty));
  return (
    <div>
      <div className="sold-tabs" role="tablist" aria-label={t("نطاق لوحة الأكثر بيعًا")}>
        <button type="button" role="tab" aria-selected={win === "all"} className={win === "all" ? "active" : ""} onClick={() => setWin("all")}>{t("كل الوقت")}</button>
        <button type="button" role="tab" aria-selected={win === "week"} className={win === "week" ? "active" : ""} onClick={() => setWin("week")}>{t("آخر 7 أيام")}</button>
      </div>
      {(!top || !top.length) ? (
        <div className="empty-state">
          <ShoppingBag size={22} />
          <p>{win === "week" ? t("لا مبيعات في آخر 7 أيام بعد.") : t("لا مبيعات مسجّلة بعد — أول طلب مؤكد سيصنع القائمة.")}</p>
        </div>
      ) : (
        <div className="sold-list">
          {top.map((r, i) => (
            <div className="sold-row" key={r.slug}>
              <span className="sold-rank">{String(i + 1).padStart(2, "0")}</span>
              {r.image ? <img src={r.image} alt="" loading="lazy" decoding="async" /> : <span className="sold-img-fallback"><ShoppingBag size={14} /></span>}
              <div className="sold-meta">
                <span className="sold-name">{r.label}</span>
                <i className="sold-track"><b style={{ width: `${Math.max(10, (r.qty / max) * 100)}%` }} /></i>
              </div>
              <div className="sold-side">
                <b>{r.qty} <small>{t("قطعة")}</small></b>
                <span>{moneyFmt(r.revenue)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// R36 — shared client-side fallback tally (stats not settled yet); week=true
// clips to the same local-midnight −6d window the server uses.
function bestFallback(orders: OrderRecord[], products: Product[], week: boolean) {
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - 6);
  const tally = new Map<string, { label: string; image: string; qty: number; revenue: number }>();
  for (const o of orders) {
    if (o.status === "cancelled" || !Array.isArray(o.items)) continue;
    if (week && new Date(o.createdAt) < weekStart) continue;
    for (const it of o.items) {
      if (!it?.id || !(it.quantity > 0)) continue;
      const p = products.find(x => x.id === it.id || x.slug === it.id);
      const cur = tally.get(it.id) || { label: it.name || it.id, image: p?.image || "", qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.price * it.quantity;
      if (!cur.image && p?.image) cur.image = p.image;
      tally.set(it.id, cur);
    }
  }
  return [...tally.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 6).map(([slug, v]) => ({ slug, ...v }));
}

// ─────────────────────────────────────────────── Coupon performance (R38, R39 lenses)
// Which discount codes actually move orders: redemptions + granted discount +
// attributed revenue per code across ALL non-cancelled orders (a cancelled
// order never redeemed). Server rows are primary truth; the client fallback
// tallies the capped orders array while stats settle. Plum accents — marketing
// semantics, keeping the section's one-accent-per-idea language: gold = sales,
// rose = gifts, plum = coupons.
// R39 — two lenses on the same data: "most used" (redemptions DESC, default)
// vs "avg basket" (revenue per redemption DESC) — the boards can disagree,
// and the disagreement is the insight (rare codes can bring richer carts).
// Every row carries ≈perPage so both views stay readable at a glance; the
// track bars re-proportion to the active metric with a width transition.
// R42 — per-code accordion drill-down: a chevron on each row expands the top
// products that code sold (thumb + name + plum share bar + units/revenue),
// turning "redeemed 3×" into "moved exactly these products".
type CouponPerfRow = { code: string; orders: number; discount: number; revenue: number; perPage: number; kind: string; value: number; label: string | null; active: boolean };
// R42 — code-level drill-down: top products each code sold (server couponItems)
type CouponDrillRow = { slug: string; nameAr: string; name: string; image: string; qty: number; revenue: number };
type CouponItemsGroup = { code: string; top: CouponDrillRow[] };
function CouponPerf({ stats, orders, onOpenOrders, onOpenProductOrders, initialOpenCode }: { stats: { couponPerf?: CouponPerfRow[]; couponPerfEff?: CouponPerfRow[]; couponItems?: CouponItemsGroup[] } | null; orders: OrderRecord[]; onOpenOrders?: (code: string) => void; onOpenProductOrders?: (slug: string, name: string, code: string) => void; initialOpenCode?: string }) {
  const t = useAdminT();
  const ar = useAdminAr();
  const moneyFmt = useAdminMoney();
  const [lens, setLens] = useState<"uses" | "basket">("uses");
  // R42 — code-level drill accordion (one code expanded at a time). The drill
  // rows come from server couponItems only — same honesty rule as the wish
  // panel: while stats settle the chevron simply doesn't render instead of
  // guessing which products a code moved.
  // R44 — initialOpenCode seeds the open drawer when the owner returns from
  // the filtered orders view (deep-link round trip). The code may not have
  // drill rows (stats settle async) — the `open` flag below is gated on the
  // rows existing, so a stale seed can never tint a drawer-less row.
  const [openCode, setOpenCode] = useState<string | null>(initialOpenCode ?? null);
  const drillMap = new Map((stats?.couponItems || []).map(g => [g.code, g.top]));
  let rows: CouponPerfRow[] | null = (lens === "basket" ? stats?.couponPerfEff : stats?.couponPerf) ?? null;
  if (!rows) {
    // Client fallback — no meta available yet, so the kind chip stays hidden
    const tally = new Map<string, { orders: number; discount: number; revenue: number }>();
    for (const o of orders) {
      if (o.status === "cancelled" || !o.couponCode) continue;
      const cur = tally.get(o.couponCode) || { orders: 0, discount: 0, revenue: 0 };
      cur.orders += 1;
      cur.discount += o.discount || 0;
      cur.revenue += o.total || 0;
      tally.set(o.couponCode, cur);
    }
    rows = [...tally.entries()]
      .map(([code, v]) => ({ code, ...v, perPage: v.orders ? Math.round(v.revenue / v.orders) : 0 }))
      .sort((a, b) => (lens === "basket" ? b.perPage - a.perPage : b.orders - a.orders || b.revenue - a.revenue))
      .slice(0, 6)
      .map(r => ({ ...r, kind: "percent", value: 0, label: null, active: false }));
  }
  if (!rows.length) {
    return <div className="empty-state"><Ticket size={22} /><p>{t("لا كوبونات مستخدمة بعد — أول كود خصم سيظهر هنا.")}</p></div>;
  }
  const totalRedemptions = rows.reduce((s, r) => s + r.orders, 0);
  const totalDiscount = rows.reduce((s, r) => s + r.discount, 0);
  const metric = (r: CouponPerfRow) => (lens === "basket" ? r.perPage : r.orders);
  const max = Math.max(1, ...rows.map(metric));
  const fromServer = !!stats?.couponPerf;
  return (
    <div>
      <div className="coupon-tabs" role="tablist" aria-label={t("نطاق لوحة الكوبونات")}>
        <button type="button" role="tab" aria-selected={lens === "uses"} className={lens === "uses" ? "on" : ""} onClick={() => setLens("uses")}>{t("الأكثر استخدامًا")}</button>
        <button type="button" role="tab" aria-selected={lens === "basket"} className={lens === "basket" ? "on" : ""} onClick={() => setLens("basket")}>{t("متوسط السلة")}</button>
      </div>
      <div
        className="coupon-sum"
        role="img"
        aria-label={ar
          ? `إجمالي ${totalRedemptions} استبدال عبر الكوبونات وخصم ممنوح بقيمة ${moneyFmt(totalDiscount)}`
          : `${totalRedemptions} total coupon redemptions, ${moneyFmt(totalDiscount)} discount granted`}
      >
        <span>{ar ? "إجمالي الاستبدالات" : "Total redemptions"} <b>{totalRedemptions}</b></span>
        <span>{t("إجمالي الخصم الممنوح")} <b>{moneyFmt(totalDiscount)}</b></span>
      </div>
      <div className="coupon-list">
        {rows.map(r => {
          const drill = drillMap.get(r.code);
          const open = openCode === r.code && !!drill?.length;
          const maxDrill = Math.max(1, ...(drill || []).map(d => d.qty));
          return (
            <Fragment key={r.code}>
              <div className={`coupon-row${open ? " expanded" : ""}`} title={r.label || r.code}>
                <span className="coupon-code">
                  <Ticket size={12} aria-hidden />
                  {r.code}
                  {fromServer && !r.active && <i className="coupon-off">{t("موقوف")}</i>}
                </span>
                <div className="coupon-meta">
                  {fromServer && (
                    <span className="coupon-kind">
                      {r.kind === "fixed" ? (ar ? `خصم ${r.value} ج.م` : `${r.value} EGP off`) : ar ? `خصم ${r.value}٪` : `${r.value}% off`}
                      <b className="coupon-avg">≈ {moneyFmt(r.perPage)} {t("لكل طلب")}</b>
                    </span>
                  )}
                  <i className="coupon-track"><b style={{ width: `${Math.max(10, (metric(r) / max) * 100)}%` }} /></i>
                </div>
                <div className="coupon-side">
                  <b>{r.orders} <small>{ar ? (r.orders === 1 ? "استبدال" : "استبدالات") : (r.orders === 1 ? "use" : "uses")}</small></b>
                  <span>{moneyFmt(r.revenue)}</span>
                </div>
                {drill && drill.length > 0 && (
                  <button
                    type="button"
                    className={`coupon-chevron${open ? " open" : ""}`}
                    aria-expanded={open}
                    aria-controls={`coupon-drill-${r.code}`}
                    title={t("ماذا باع هذا الكود؟")}
                    aria-label={t("ماذا باع هذا الكود؟")}
                    onClick={() => setOpenCode(open ? null : r.code)}
                  >
                    <ChevronDown size={13} aria-hidden />
                  </button>
                )}
              </div>
              {drill && open && (
                <div className="coupon-drill" id={`coupon-drill-${r.code}`} role="region" aria-label={ar ? `المنتجات التي باعها كود ${r.code}` : `Products sold by code ${r.code}`}>
                  <span className="coupon-drill-cap">{t("أعلى المنتجات لهذا الكود")}</span>
                  {drill.map((d, i) => (
                    <div className="coupon-drill-row" key={d.slug} style={{ "--i": i } as CSSProperties} title={ar ? d.nameAr : d.name}>
                      {d.image
                        ? <img className="coupon-drill-thumb" src={d.image} alt="" loading="lazy" decoding="async" />
                        : <span className="coupon-drill-thumb"><Ticket size={11} aria-hidden /></span>}
                      <div className="coupon-drill-mid">
                        <span className="coupon-drill-name">{ar ? d.nameAr : d.name}</span>
                        <i className="coupon-drill-track"><b style={{ width: `${Math.max(10, (d.qty / maxDrill) * 100)}%` }} /></i>
                      </div>
                      <div className="coupon-drill-side">
                        <b>{d.qty} <small>{t("قطعة")}</small></b>
                        <span>{moneyFmt(d.revenue)}</span>
                      </div>
                      {/* R45 — per-product hand-off: jump to the orders table
                          filtered to this exact slug (gold arrow, RTL-forward). */}
                      {onOpenProductOrders && (
                        <button
                          type="button"
                          className="coupon-drill-link"
                          onClick={() => onOpenProductOrders(d.slug, ar ? d.nameAr : d.name, r.code)}
                          title={t("افتح طلبات هذا المنتج")}
                          aria-label={`${t("افتح طلبات هذا المنتج")} — ${ar ? d.nameAr : d.name}`}
                        >
                          <ArrowLeft size={12} aria-hidden />
                        </button>
                      )}
                    </div>
                  ))}
                  {onOpenOrders && (
                    <button
                      type="button"
                      className="coupon-orders-link"
                      onClick={() => onOpenOrders(r.code)}
                      title={t("افتح جدول الطلبات مفلترًا على هذا الكود")}
                    >
                      {t("عرض طلبات هذا الكود")} ({r.orders}) <ArrowLeft size={12} aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── Wishlist demand (R40)
// Which products visitors SAVE the most, side-by-side with the units each one
// actually sold — "wished but never bought" is friction the sales board alone
// can't show (price hesitation, stock gaps, shipping cost). Server rows are
// the only source of wish truth (the client never had the events), so while
// stats settle the body simply stays empty instead of guessing; after that a
// true zero-state shows until the first visitor saves something. Teal accents
// — demand identity, extending the section's one-accent-per-idea language:
// gold = sales, rose = gifts/shares, plum = coupons, teal = wishlist.
type WishRow = { slug: string; nameAr: string; name: string; image: string; adds: number; sold: number; trend?: number[]; week?: number };
type RailBoardRow = { slug: string; nameAr: string; name: string; image: string; pulls: number; sold: number; revenue: number };
// R53 — one window of the mix classification (same shape/semantics as
// orderMix: coupon counts both-orders, organic is the inclusion-exclusion rest)
type MixWindow = { net: number; coupon: number; rail: number; both: number; organic: number };
// R55 — optional `revenue` rides the same window shape (summed totals, not
// counts): older cached payloads without it simply hide the money table.
type MixTrend = { current: MixWindow; previous: MixWindow; revenue?: { current: MixWindow; previous: MixWindow } };

// R50 — rail leaderboard: the cross-sell rail's top pulled products with
// pulls (teal) vs conversions (gold) side by side, same max so the gold bar
// reads as the pull→order ratio. Covers EVERY pulled target — unlike the
// wish board, a product pulled from the rail but never wishlisted still
// shows here, so the rail's pull is never invisible. Honest empty state
// before the first rail click, per the no-fake-data convention.
// R56 — revenue lens: each converted row wears a gold money chip (line
// revenue, best-sellers semantics — qty × price, no shipping). A converted
// pull whose order didn't contain THIS product shows an honest muted 0 —
// sold ≥ 1 with revenue 0 is information ("converted away"), not a bug.
// The footer total is over ALL rail-attributed orders' lines (the board is
// top-5 pulls only), so it can exceed the visible rows' sum.
// R57 — rate lens: converted rows wear a NEUTRAL efficiency chip (sold ÷
// pulls — one division, the R54 share lens mirrored onto the board); the
// footer gains the aggregate funnel line (converted pulls ÷ ALL pulls,
// fraction shown because small denominators must stay auditable). Rate is
// neither desire (teal) nor money (gold) — it wears quiet neutral ink.
function RailBoard({ stats }: { stats: { railBoard?: RailBoardRow[]; railRevenueTotal?: number; railPulls?: { slug: string; count: number }[]; railConversions?: number } | null }) {
  const ar = useAdminAr();
  const rows = stats?.railBoard;
  const totalRev = stats?.railRevenueTotal ?? 0;
  const totalPulls = (stats?.railPulls || []).reduce((a, p) => a + p.count, 0);
  const conversions = stats?.railConversions ?? 0;
  if (!rows) return null; // settling — the server is the only source of rail truth
  if (!rows.length) {
    return <div className="empty-state"><Sparkles size={22} /><p>{ar ? "لا نقرات من الريل بعد — ستظهر مع أول نقرة على بطاقة المقترحات." : "No rail clicks yet — they appear with the first cross-sell card click."}</p></div>;
  }
  const money = (n: number) => n.toLocaleString("en-US");
  const rate = (sold: number, pulls: number) => Math.round((sold / Math.max(1, pulls)) * 100);
  const maxPulls = Math.max(1, ...rows.map(r => r.pulls));
  return (
    <div className="rail-board">
      {rows.map((r, i) => (
        <div className="rail-board-row" key={r.slug} style={{ "--i": i } as CSSProperties} title={ar ? r.nameAr : r.name}>
          {r.image
            ? <img className="rail-thumb" src={r.image} alt="" />
            : <span className="rail-thumb rail-thumb-empty"><Sparkles size={14} aria-hidden /></span>}
          <div className="rail-mid">
            <span className="rail-name">{ar ? r.nameAr : r.name}</span>
            <i className="rail-track pulls" role="img" aria-label={ar ? `${r.nameAr}: ${r.pulls} نقرة من الريل` : `${r.name}: ${r.pulls} rail clicks`}>
              <b style={{ width: `${Math.max(10, (r.pulls / maxPulls) * 100)}%` }} />
            </i>
            {r.sold > 0 && (
              <i className="rail-track sold" role="img" aria-label={ar ? `${r.nameAr}: ${r.sold} وصلت لطلب` : `${r.name}: ${r.sold} became orders`}>
                <b style={{ width: `${Math.max(10, (r.sold / maxPulls) * 100)}%` }} />
              </i>
            )}
          </div>
          <div className="rail-side">
            <span className="rail-pulls-chip" title={ar ? "نقرات من ريل المقترحات في واجهة المتجر" : "Clicks from the cross-sell rail on the storefront"}>
              <Sparkles size={10} aria-hidden /> {r.pulls} {ar ? (r.pulls === 1 ? "نقرة" : "نقرات") : (r.pulls === 1 ? "click" : "clicks")}
            </span>
            {r.sold > 0 && (
              <span className="rail-sold-chip" title={ar ? "طلبات جاءت من نقرات الريل خلال 24 ساعة" : "Orders from rail clicks within 24 hours"}>
                {r.sold} {ar ? (r.sold === 1 ? "طلب" : "طلبات") : (r.sold === 1 ? "order" : "orders")}
              </span>
            )}
            {r.sold > 0 && (
              <span
                className="rail-rate-chip"
                dir="ltr"
                title={ar
                  ? `نسبة التحويل: ${r.sold} من ${r.pulls} ${r.pulls === 1 ? "نقرة" : "نقرات"} — ${rate(r.sold, r.pulls)}%`
                  : `Conversion rate: ${r.sold} of ${r.pulls} ${r.pulls === 1 ? "click" : "clicks"} — ${rate(r.sold, r.pulls)}%`}
                aria-label={ar
                  ? `نسبة التحويل ${rate(r.sold, r.pulls)} بالمئة`
                  : `conversion rate ${rate(r.sold, r.pulls)} percent`}
              >
                {rate(r.sold, r.pulls)}%
              </span>
            )}
            {r.sold > 0 && (
              <span
                className={`rail-rev-chip${r.revenue > 0 ? "" : " zero"}`}
                dir="ltr"
                title={r.revenue > 0
                  ? ar
                    ? `إيراد أصناف هذا المنتج داخل الطلبات المنسوبة للريل — الكمية × السعر، بدون الشحن أو الخصم (${money(r.revenue)} ج.م)`
                    : `This product's line revenue inside rail-attributed orders — qty × price, no shipping or discount (${money(r.revenue)} EGP)`
                  : ar
                    ? "الطلب المنسوب لم يحتوي صنف هذا المنتج — إيراد السطر صفر"
                    : "The attributed order didn't include this product's line — zero line revenue"}
              >
                {money(r.revenue)} {ar ? "ج.م" : "EGP"}
              </span>
            )}
          </div>
        </div>
      ))}
      {totalPulls > 0 && (
        <p className="rail-rev-rate" title={ar
          ? `نقرات الريل التي تحولت لطلبات خلال 24 ساعة من إجمالي نقرات كل المنتجات — ${conversions} من ${totalPulls}`
          : `Rail clicks that converted to orders within 24h, over ALL products' clicks — ${conversions} of ${totalPulls}`}>
          {ar
            ? `تحولت ${conversions} من ${totalPulls} ${totalPulls === 1 ? "نقرة" : "نقرات"} عبر الريل`
            : `${conversions} of ${totalPulls} rail ${totalPulls === 1 ? "click" : "clicks"} converted`}
          <b dir="ltr"> ({rate(conversions, totalPulls)}%)</b>
        </p>
      )}
      {totalRev > 0 && (
        <p className="rail-rev-total" title={ar
          ? "إيراد أصناف كل الطلبات المنسوبة للريل (كل المنتجات، ليست صفوف اللوحة فقط) — الكمية × السعر، بدون الشحن أو الخصم"
          : "Line revenue across ALL rail-attributed orders (every product, not just the rows above) — qty × price, no shipping or discount"}>
          {ar ? "إيراد طلبات الريل: " : "Rail orders' line revenue: "}
          <b dir="ltr">{money(totalRev)} {ar ? "ج.م" : "EGP"}</b>
        </p>
      )}
    </div>
  );
}

// R51 — order mix: ONE stacked bar answering "where do orders come from" —
// coupon (plum, the coupon dialect), rail (gold, the R50 attribution),
// organic (neutral). An order can be both coupon AND rail; the bar
// classifies by coupon precedence and discloses the overlap in a note
// instead of hiding it — server truth only, honest zero-state before the
// first order.
function OrderMix({ stats, onOpenSource }: { stats: { orderMix?: { net: number; coupon: number; rail: number; both: number; organic: number }; mixTrend?: MixTrend } | null; onOpenSource?: (source: "coupon" | "rail" | "organic", days?: number) => void }) {
  const ar = useAdminAr();
  const mix = stats?.orderMix;
  const trend = stats?.mixTrend;
  if (!mix) return null; // settling — the server is the only source of truth
  if (!mix.net) {
    return <div className="empty-state"><ShoppingBag size={22} /><p>{ar ? "لا طلبات بعد — المزيج يظهر مع أول طلب." : "No orders yet — the mix appears with the first order."}</p></div>;
  }
  const railOnly = Math.max(0, mix.rail - mix.both);
  const couponOnly = Math.max(0, mix.coupon - mix.both);
  const pct = (n: number) => (n / mix.net) * 100;
  const seg = [
    { key: "coupon", n: couponOnly, cls: "coupon" },
    { key: "both", n: mix.both, cls: "both" },
    { key: "rail", n: railOnly, cls: "rail" },
    { key: "organic", n: mix.organic, cls: "organic" },
  ].filter(s => s.n > 0);
  return (
    <div className="order-mix">
      <div
        className="order-mix-bar"
        role="img"
        aria-label={ar
          ? `من ${mix.net} طلب: ${mix.coupon} بالكوبون، ${mix.rail} من الريل، ${mix.organic} طبيعية`
          : `Of ${mix.net} orders: ${mix.coupon} coupon, ${mix.rail} rail, ${mix.organic} organic`}
      >
        {seg.map(s => (
          <i key={s.key} className={`order-mix-seg ${s.cls}`} style={{ width: `${pct(s.n)}%` }}
            title={ar
              ? ({ coupon: "طلبات كوبونات فقط", both: "كوبون + ريل معًا", rail: "طلبات من الريل فقط", organic: "حركة طبيعية — بدون كوبون أو ريل" } as Record<string, string>)[s.key]
              : ({ coupon: "Coupon orders only", both: "Coupon + rail together", rail: "Rail orders only", organic: "Organic — no coupon, no rail" } as Record<string, string>)[s.key]} />
        ))}
      </div>
      <div className="order-mix-legend">
        {/* R52 — the legend IS the drill: each key jumps to the orders view
            filtered to that source (the mix panel's own numbers, browsable). */}
        {([
          { key: "coupon" as const, label: ar ? "كوبونات" : "Coupons", n: mix.coupon, tip: ar ? "طلبات استخدمت كود خصم — اضغطي لعرضها" : "Orders that used a discount code — click to view" },
          { key: "rail" as const, label: ar ? "من الريل" : "From rail", n: mix.rail, tip: ar ? "طلبات جاءت عبر ريل المقترحات (نقرة حولت لطلب خلال 24 ساعة) — اضغطي لعرضها" : "Orders that arrived through the cross-sell rail (a click converted within 24h) — click to view" },
          { key: "organic" as const, label: ar ? "طبيعية" : "Organic", n: mix.organic, tip: ar ? "بدون كوبون ودون ريل — اضغطي لعرضها" : "No coupon and no rail — click to view" },
        ]).map(k => (
          <button key={k.key} type="button" className={`order-mix-key ${k.key}`}
            title={k.tip}
            aria-label={`${k.tip} (${k.n})`}
            onClick={onOpenSource ? () => onOpenSource(k.key) : undefined}>
            <i aria-hidden /> {k.label} <b>{k.n}</b>
          </button>
        ))}
        <span className="order-mix-total">{ar ? `من ${mix.net} طلب` : `of ${mix.net} orders`}</span>
      </div>
      {mix.both > 0 && (
        <p className="order-mix-note">{ar
          ? `${mix.both} ${mix.both === 1 ? "طلب يحقق شرطي العضوية معًا" : "طلبات تحقق شرطي العضوية معًا"} (كوبون + ريل) — تُحسب ضمن الكوبونات في الشريط.`
          : `${mix.both} order${mix.both === 1 ? "" : "s"} matched both (coupon + rail) — counted under coupons in the bar.`}</p>
      )}
      {/* R53 — week-over-week trend: the SAME classification over the last 7
          days vs the 7 before (server windows, disjoint — no order counts on
          both sides of a delta). Each chip is a real button: it jumps to that
          source's orders INSIDE the same 7-day window (source + days drill,
          so the chip's week and the landed view always agree). Hidden while
          BOTH windows are empty — honest absence, not a row of zeros. */}
      {trend && (trend.current.net > 0 || trend.previous.net > 0) && (
        <div
          className="mix-trend"
          role="group"
          aria-label={ar
            ? `مقارنة بالأسبوع الماضي: ${trend.current.net} طلب في آخر ٧ أيام مقابل ${trend.previous.net} في الأسبوع الذي قبله`
            : `Week over week: ${trend.current.net} orders in the last 7 days vs ${trend.previous.net} the week before`}
        >
          <span className="mix-trend-label">{ar ? "مقارنة بالأسبوع الماضي" : "Week over week"}</span>
          <div className="mix-trend-chips">
            {([
              { key: "coupon" as const, label: ar ? "كوبونات" : "Coupons" },
              { key: "rail" as const, label: ar ? "من الريل" : "From rail" },
              { key: "organic" as const, label: ar ? "طبيعية" : "Organic" },
            ]).map(k => {
              const d = trend.current[k.key] - trend.previous[k.key];
              const Dir = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
              // R54 — share lens: the delta says "moved", the share says
              // "mattered". This week's slice of the window (of THIS week's
              // orders), and — only when the previous window had orders —
              // the share-vs-share movement in the tooltip. Same coupon-
              // includes-both convention as the legend above.
              const curShare = trend.current.net > 0 ? Math.round((trend.current[k.key] / trend.current.net) * 100) : 0;
              const prevShare = trend.previous.net > 0 ? Math.round((trend.previous[k.key] / trend.previous.net) * 100) : null;
              return (
                <button
                  key={k.key}
                  type="button"
                  className={`mix-trend-chip ${k.key} ${d > 0 ? "up" : d < 0 ? "down" : "flat"}`}
                  title={ar
                    ? `آخر ٧ أيام: ${trend.current[k.key]} — الأسبوع السابق: ${trend.previous[k.key]} — ${prevShare === null ? `الحصة: ${curShare}% من طلبات الأسبوع` : `الحصة: ${curShare}% من طلبات الأسبوع مقابل ${prevShare}% بالأسبوع الذي قبله`} — اضغطي لعرض طلبات هذا المصدر في آخر ٧ أيام`
                    : `Last 7 days: ${trend.current[k.key]} — previous week: ${trend.previous[k.key]} — ${prevShare === null ? `share: ${curShare}% of the week's orders` : `share: ${curShare}% of the week's orders vs ${prevShare}% the week before`} — click to view this source's orders from the last 7 days`}
                  aria-label={ar
                    ? `${k.label}: ${d > 0 ? `زيادة ${d}` : d < 0 ? `انخفاض ${Math.abs(d)}` : "بدون تغيير"}، ${curShare} بالمئة من طلبات الأسبوع — عرض طلبات هذا المصدر في آخر ٧ أيام`
                    : `${k.label}: ${d > 0 ? `up ${d}` : d < 0 ? `down ${Math.abs(d)}` : "unchanged"}, ${curShare} percent of the week's orders — view this source's orders from the last 7 days`}
                  onClick={onOpenSource ? () => onOpenSource(k.key, 7) : undefined}
                >
                  <i aria-hidden /> {k.label} <b><Dir size={10} aria-hidden /> {d > 0 ? `+${d}` : d < 0 ? `${d}` : "0"}</b> <small className="mix-trend-share" dir="ltr">{curShare}%</small>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* R55 — week-over-week REVENUE by source: the count chips above say a
          source "moved"; this mini-table says whether it was WORTH it (EGP
          over the SAME disjoint windows, same coupon-includes-both
          convention as the legend and the chips). Read-only by design — the
          chips remain the only drill, because money has no different orders
          to show. A `was` ghost carries the previous week on every row so
          the delta never reads without its base. Hidden while BOTH revenue
          windows are empty — honest absence, not a table of zeros. */}
      {trend?.revenue && (trend.revenue.current.net > 0 || trend.revenue.previous.net > 0) && (() => {
        const rev = trend.revenue;
        const money = (n: number) => n.toLocaleString("en-US");
        const rows: { key: "coupon" | "rail" | "organic"; label: string }[] = [
          { key: "coupon", label: ar ? "كوبونات" : "Coupons" },
          { key: "rail", label: ar ? "من الريل" : "From rail" },
          { key: "organic", label: ar ? "طبيعية" : "Organic" },
        ];
        const delta = (cur: number, prev: number) => {
          const d = cur - prev;
          const cls = d > 0 ? "up" : d < 0 ? "down" : "flat";
          const DirIcon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
          return { d, cls, DirIcon };
        };
        const rowTitle = (label: string, cur: number, prev: number) => ar
          ? `آخر ٧ أيام: ${money(cur)} ج.م — الأسبوع السابق: ${money(prev)} ج.م — ${label}`
          : `Last 7 days: ${money(cur)} EGP — previous week: ${money(prev)} EGP — ${label}`;
        return (
          <div
            className="mix-rev"
            role="group"
            aria-label={ar
              ? `إيراد آخر ٧ أيام حسب المصدر: ${money(rev.current.net)} ج.م مقابل ${money(rev.previous.net)} ج.م بالأسبوع الذي قبله`
              : `Last-7-day revenue by source: ${money(rev.current.net)} EGP vs ${money(rev.previous.net)} EGP the week before`}
          >
            <span className="mix-rev-label">{ar ? "إيراد الأسبوع حسب المصدر (ج.م)" : "Week revenue by source (EGP)"}</span>
            {rows.map(k => {
              const cur = rev.current[k.key];
              const prev = rev.previous[k.key];
              const { d, cls, DirIcon } = delta(cur, prev);
              return (
                <div key={k.key} className={`mix-rev-row ${k.key}`} role="group"
                  aria-label={ar
                    ? `${k.label}: ${money(cur)} ج.م هذا الأسبوع مقابل ${money(prev)} ج.م بالأسبوع الذي قبله`
                    : `${k.label}: ${money(cur)} EGP this week vs ${money(prev)} EGP the week before`}
                  title={rowTitle(k.label, cur, prev)}>
                  <span className="mix-rev-src"><i aria-hidden /> {k.label}</span>
                  <b className="mix-rev-cur" dir="ltr">{money(cur)}</b>
                  <span className="mix-rev-prev" dir="ltr">{ar ? `كان ${money(prev)}` : `was ${money(prev)}`}</span>
                  <span className={`mix-rev-delta ${cls}`} dir="ltr">
                    <DirIcon size={10} aria-hidden /> {d > 0 ? `+${money(d)}` : d < 0 ? money(d) : "0"}
                  </span>
                </div>
              );
            })}
            {(() => {
              const { d, cls, DirIcon } = delta(rev.current.net, rev.previous.net);
              return (
                <div className="mix-rev-row mix-rev-total-row" title={rowTitle(ar ? "الإجمالي" : "Total", rev.current.net, rev.previous.net)}>
                  <span className="mix-rev-src">{ar ? "الإجمالي" : "Total"}</span>
                  <b className="mix-rev-cur" dir="ltr">{money(rev.current.net)}</b>
                  <span className="mix-rev-prev" dir="ltr">{ar ? `كان ${money(rev.previous.net)}` : `was ${money(rev.previous.net)}`}</span>
                  <span className={`mix-rev-delta ${cls}`} dir="ltr">
                    <DirIcon size={10} aria-hidden /> {d > 0 ? `+${money(d)}` : d < 0 ? money(d) : "0"}
                  </span>
                </div>
              );
            })()}
            {(rev.current.both > 0 || rev.previous.both > 0) && (
              <p className="mix-rev-note">{ar
                ? "إيراد الكوبونات يشمل طلبات كوبون + ريل معًا — نفس طريقة حساب الشريط."
                : "Coupon revenue includes coupon + rail orders — same convention as the bar."}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
function WishPanel({ stats, onOpenProductOrders }: { stats: { topWished?: WishRow[]; railPulls?: { slug: string; count: number }[]; railConversions?: number; railSold?: { slug: string; count: number }[]; wishAdds?: number; wishTrend?: { date: string; adds: number }[]; wishAddsWeek?: number; wishAddsPrevWeek?: number } | null; onOpenProductOrders?: (slug: string, name: string, code: string) => void }) {
  const t = useAdminT();
  const ar = useAdminAr();
  const rows = stats?.topWished;
  // R47 — cross-sell attribution: clicks each product's card earned from the
  // storefront also-saved rails (server groupBy targetId). A row with pulls
  // gets a teal chip — the rail is measurably pulling demand for it.
  const pullsBySlug = new Map((stats?.railPulls || []).map(p => [p.slug, p.count]));
  // R49 — per-target conversions: of those rail pulls, how many of THIS
  // product's rail clicks ended as an order (convertedAt stamped within 24h).
  // Gold chip lands on the exact row that earned revenue — the aggregate
  // sum-level line can't say where it landed.
  const railSoldBySlug = new Map((stats?.railSold || []).map(p => [p.slug, p.count]));
  if (!rows) return null; // settling — the server is the only source of wish truth
  if (!rows.length) {
    return <div className="empty-state"><Heart size={22} /><p>{t("لا أمنيات بعد — المنتجات ستظهر هنا مع أول إضافة للمفضلة.")}</p></div>;
  }
  const wishAdds = stats?.wishAdds ?? rows.reduce((s, r) => s + r.adds, 0);
  const unsold = rows.filter(r => r.sold === 0).length;
  const max = Math.max(1, ...rows.map(r => r.adds));
  // R41 — daily adds sparkline + week-over-week chip (same 7 buckets as the
  // sales/gift series; shown whenever the server trend is present, with quiet
  // days as stubs — a flat week is itself a demand signal)
  const trend = stats?.wishTrend;
  const addsWeek = stats?.wishAddsWeek ?? 0;
  const addsPrevWeek = stats?.wishAddsPrevWeek ?? 0;
  const maxAdds = Math.max(1, ...(trend || []).map(p => p.adds));
  const weekday = (date: string) => new Date(date + "T00:00:00").toLocaleDateString(ar ? "ar-EG" : "en-GB", { weekday: ar ? "long" : "short" });
  // R44 — row-level demand timing: the server pairs each top-wishlisted row
  // with its own 7 daily buckets (same grid as the aggregate spark), revealed
  // on hover/focus so the board stays calm until a row is inspected. Dates
  // come from the shared wishTrend series so column titles match the panel.
  const trendDates = stats?.wishTrend?.map(p => p.date) || [];
  const rowSpark = (r: WishRow) => {
    if (!r.trend || r.trend.length !== 7) return null;
    const rowMax = Math.max(1, ...r.trend);
    const week = r.week ?? r.trend.reduce((s, v) => s + v, 0);
    return (
      <div
        className="wish-row-spark"
        role="img"
        aria-label={ar
          ? `${r.nameAr}: ${week} إضافة في آخر 7 أيام`
          : `${r.name}: ${week} saves in the last 7 days`}
      >
        <span className="wish-row-spark-cap">{t("إضافات آخر 7 أيام")} · <b>{week}</b></span>
        <i className="wish-row-spark-bars">
          {r.trend.map((v, j) => (
            <span key={j} className="wish-row-col" title={trendDates[j] ? `${weekday(trendDates[j])} · ${v}` : String(v)}>
              <b className={v > 0 ? "" : "empty"} style={{ height: v > 0 ? `${Math.max(22, (v / rowMax) * 100)}%` : "30%" }} />
            </span>
          ))}
        </i>
      </div>
    );
  };
  return (
    <div>
      <div
        className="wish-sum"
        role="img"
        aria-label={ar
          ? `إجمالي ${wishAdds} إضافة للمفضلة، منها ${unsold} منتج لم يُبع بعد`
          : `${wishAdds} total wishlist saves, ${unsold} of them not sold yet`}
      >
        <span>{ar ? "إجمالي الإضافات" : "Total saves"} <b>{wishAdds}</b></span>
        {(stats?.railConversions ?? 0) > 0 && (
          <i className="wish-converted" title={ar ? "نقرات من ريل المقترحات انتهت بطلب خلال 24 ساعة" : "Rail clicks that ended as an order within 24 hours"}>
            <Sparkles size={10} aria-hidden /> {ar ? `وصل ${stats?.railConversions} منها لطلب` : `${stats?.railConversions} became orders`}
          </i>
        )}
        {unsold > 0 && <i className="wish-unsold">{ar ? `${unsold} منتج لم يُبع بعد` : `${unsold} not sold yet`}</i>}
      </div>
      {/* R49 — demand snapshot offline: same server CSV stream the orders
          table got in R29 (full history, BOM for Excel/Arabic, audited). The
          board shows the top rows; the file carries EVERY wishlisted product
          with the rail-attribution columns joined alongside. */}
      <a className="wish-export tool-button" href="/api/admin/wishlist/export" download
        title={t("تصدير لوحة الأمنيات — ملف CSV كامل")}>
        <Download size={12} aria-hidden /> {t("تصدير CSV")}
      </a>
      <div className="wish-list">
        {rows.map((r, i) => {
          const pulls = pullsBySlug.get(r.slug) || 0;
          const converted = railSoldBySlug.get(r.slug) || 0;
          const name = ar ? r.nameAr : r.name;
          const openOrders = onOpenProductOrders ? () => onOpenProductOrders(r.slug, name, "") : undefined;
          return (
            <div className="wish-row" key={r.slug} style={{ "--i": i } as CSSProperties} title={name} tabIndex={0}
              role={openOrders ? "button" : undefined}
              onClick={openOrders}
              onKeyDown={openOrders ? (e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openOrders(); } }) : undefined}>
              {r.image
                ? <img className="wish-thumb" src={r.image} alt="" />
                : <span className="wish-thumb wish-thumb-empty"><Heart size={14} aria-hidden /></span>}
              <div className="wish-mid">
                <span className="wish-name">{name}</span>
                <i className="wish-track"><b style={{ width: `${Math.max(10, (r.adds / max) * 100)}%` }} /></i>
                {rowSpark(r)}
              </div>
              <div className="wish-side">
                <b>{r.adds} <small>{ar ? (r.adds === 1 ? "إضافة" : "إضافات") : (r.adds === 1 ? "save" : "saves")}</small></b>
                <span className={r.sold === 0 ? "wish-sold zero" : "wish-sold"}>
                  {r.sold === 0 ? t("لم تُبع بعد") : (ar ? `المبيعات ${r.sold}` : `${r.sold} sold`)}
                </span>
                {pulls > 0 && (
                  <span className="wish-rail-chip" title={ar ? `نقرات من ريل المقترحات في واجهة المتجر` : `Clicks from the cross-sell rail on the storefront`}>
                    <Sparkles size={10} aria-hidden /> {ar ? "من الريل" : "from rail"} · {pulls}
                  </span>
                )}
                {converted > 0 && (
                  <span className="wish-converted wish-converted-row" title={ar ? `طلبات جاءت من نقرات هذا المنتج في ريل المقترحات خلال 24 ساعة` : `Orders that came from this product's cross-sell rail clicks within 24 hours`}>
                    <Sparkles size={10} aria-hidden /> {ar ? `وصل ${converted} لطلب` : `${converted} became orders`}
                  </span>
                )}
                {openOrders && (
                  <button type="button" className="coupon-drill-link wish-orders-link"
                    aria-label={`${t("افتح طلبات هذا المنتج")} — ${name}`}
                    title={t("افتح طلبات هذا المنتج")}
                    onClick={e => { e.stopPropagation(); openOrders(); }}>
                    <ArrowLeft size={12} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {trend && (() => {
        const delta = addsWeek - addsPrevWeek;
        const deltaTxt = delta === 0
          ? (ar ? `مطابق للأسبوع الماضي (${addsPrevWeek})` : `same as last week (${addsPrevWeek})`)
          : (delta > 0
            ? (ar ? `+${delta} عن الأسبوع الماضي (${addsPrevWeek})` : `+${delta} vs last week (${addsPrevWeek})`)
            : (ar ? `${delta} عن الأسبوع الماضي (${addsPrevWeek})` : `${delta} vs last week (${addsPrevWeek})`));
        return (
          <div className="wish-spark-wrap">
            <span className="wish-spark-cap">
              {t("إضافات آخر 7 أيام")}
              {addsWeek > 0 && <b className="wish-week-chip" title={deltaTxt}>{ar ? `${addsWeek} هذا الأسبوع` : `${addsWeek} this week`}</b>}
            </span>
            <div
              className="wish-spark"
              role="img"
              aria-label={ar ? `إضافات المفضلة خلال آخر 7 أيام — ${addsWeek} هذا الأسبوع` : `Wishlist saves over the last 7 days — ${addsWeek} this week`}
            >
              {trend.map((p, i) => (
                <span
                  className="wish-spark-col"
                  key={p.date}
                  title={`${weekday(p.date)} · ${p.adds}`}
                  style={{ "--i": i } as CSSProperties}
                >
                  <b className={p.adds > 0 ? "" : "empty"} style={{ height: `${p.adds > 0 ? Math.max(14, (p.adds / maxAdds) * 100) : 8}%` }} />
                </span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────── Peak hours (R36)
// 24-bucket hour-of-day histogram over the last 30 days — server buckets are
// primary truth; the client fallback rebuilds them from the capped orders
// array so the panel isn't blank while stats settle. Pure CSS bars, no chart
// lib. The chart is forced LTR so hour 0 sits at the left edge matching the
// 00/06/12/18 ruler — time axes read left-to-right even in the RTL studio.
function PeakHours({ stats, orders }: { stats: { ordersByHour?: number[] } | null; orders: OrderRecord[] }) {
  const t = useAdminT();
  const ar = useAdminAr();
  const hourFmt = (h: number) => new Date(2024, 0, 1, h).toLocaleTimeString(ar ? "ar-EG" : "en-US", { hour: "numeric" });
  let hours = stats?.ordersByHour;
  if (!hours) {
    const start30 = new Date(); start30.setHours(0, 0, 0, 0); start30.setDate(start30.getDate() - 29);
    hours = Array.from({ length: 24 }, () => 0);
    for (const o of orders) {
      const d = new Date(o.createdAt);
      if (d < start30) continue;
      hours[d.getHours()] += 1;
    }
  }
  const total = hours.reduce((a, b) => a + b, 0);
  if (!total) {
    return <div className="empty-state"><Clock size={22} /><p>{t("لا طلبات في آخر 30 يومًا بعد — سيظهر توزيع الساعات هنا.")}</p></div>;
  }
  const max = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  const peakCount = hours[peak];
  const sentence = ar
    ? `أعلى ذروة للطلبات: ${hourFmt(peak)} (${peakCount} ${peakCount === 1 ? "طلب" : "طلبات"} من ${total})`
    : `Peak ordering hour: ${hourFmt(peak)} (${peakCount} ${peakCount === 1 ? "order" : "orders"} of ${total})`;
  return (
    <div>
      <div className="hours-chart" role="img" aria-label={sentence}>
        {hours.map((c, i) => (
          <span className={`hours-bar${i === peak && c > 0 ? " peak" : ""}${c === 0 ? " zero" : ""}`} key={i} title={`${hourFmt(i)} · ${c}`} style={{ "--i": i } as CSSProperties}>
            <i style={{ height: `${c === 0 ? 4 : Math.max(8, (c / max) * 100)}%` }} />
          </span>
        ))}
      </div>
      <div className="hours-labels" dir="ltr" aria-hidden><span>00</span><span>06</span><span>12</span><span>18</span></div>
      <p className="hours-peak-note">{sentence}</p>
    </div>
  );
}

// ─────────────────────────────────────────────── Repeat purchase rate (R37)
// Share of customers (distinct phones, non-cancelled orders) who placed more
// than one order in the last 30 days — server pair is primary truth, the
// client fallback tallies the capped orders array while stats settle.
// Gold stat tile (sales semantics) instead of a second ring so the section
// keeps one ring per idea: rose = gifts, gold = money.
function RepeatRate({ stats, orders }: { stats: { repeat30?: { total: number; repeat: number; rate: number } } | null; orders: OrderRecord[] }) {
  const t = useAdminT();
  const ar = useAdminAr();
  let r = stats?.repeat30;
  if (!r) {
    const start30 = new Date(); start30.setHours(0, 0, 0, 0); start30.setDate(start30.getDate() - 29);
    const tally = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "cancelled" || new Date(o.createdAt) < start30) continue;
      tally.set(o.customerPhone, (tally.get(o.customerPhone) || 0) + 1);
    }
    const total = tally.size;
    const repeat = [...tally.values()].filter(v => v > 1).length;
    r = { total, repeat, rate: total ? Math.round((repeat / total) * 100) : 0 };
  }
  if (!r.total) {
    return <div className="empty-state"><Users size={22} /><p>{t("لا عملاء في آخر 30 يومًا بعد — سيظهر المعدل مع أول طلب.")}</p></div>;
  }
  const sentence = ar
    ? `${r.repeat} من ${r.total} عملاء رجعوا للشراء أكثر من مرة خلال آخر 30 يومًا`
    : `${r.repeat} of ${r.total} customers came back to buy more than once in the last 30 days`;
  return (
    <div className="repeat-body">
      <div
        className="repeat-badge"
        role="img"
        aria-label={ar ? `${r.rate} بالمئة من العملاء رجعوا للشراء خلال آخر 30 يومًا` : `${r.rate} percent of customers came back within the last 30 days`}
      >
        <b>{r.rate}%</b>
        <span>{t("من العملاء")}</span>
      </div>
      <div className="repeat-meta">
        <p>{sentence}</p>
        <div className="repeat-chips">
          <span>{t("كل العملاء (30 يومًا)")} <b>{r.total}</b></span>
          <span>{t("عملاء متكررون")} <b>{r.repeat}</b></span>
        </div>
      </div>
    </div>
  );
}

// Most-shared products — storefront share actions (wa/fb/x/copy) recorded via /api/store/products/share
// R30 — hero-campaign titles render on one line (their titles contain \n)
const oneLineAr = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();
function MostShared({ products, weekly = {}, campaigns = [] }: { products: Product[]; weekly?: Record<string, { count: number; prev: number }>; campaigns?: { id: string; titleAr: string; titleEn: string; image: string; total: number; week: number; prev: number }[] }) {
  const t = useAdminT();
  const ar = useAdminAr();
  // R30 — one board, two sources: product rows (lifetime shareCount) merged
  // with campaign rows (lifetime hero:<slideId> ShareEvent totals) — the top
  // entries win regardless of kind, campaigns carry a rose "حملة" chip.
  const productRows = products
    .filter(p => (p.shareCount || 0) > 0)
    .map(p => ({ key: p.id, img: p.image, name: ar ? p.nameAr : (p.name || p.nameAr), count: p.shareCount || 0, delta: (() => { const w = weekly[p.id]; return w ? w.count - w.prev : 0; })(), campaign: false as const }));
  const campaignRows = campaigns
    .filter(c => c.total > 0)
    .map(c => ({ key: `hero:${c.id}`, img: c.image, name: ar ? oneLineAr(c.titleAr) : (oneLineAr(c.titleEn) || oneLineAr(c.titleAr)), count: c.total, delta: c.week - c.prev, campaign: true as const }));
  const top = [...productRows, ...campaignRows].sort((a, b) => b.count - a.count).slice(0, 6);
  const max = Math.max(1, ...top.map(r => r.count));
  if (!top.length) {
    return (
      <div className="empty-state">
        <Share2 size={22} />
        <p>{t("لا توجد مشاركات مسجّلة بعد — أول مشاركة من زر \"مشاركة المنتج\" ستظهر هنا.")}</p>
      </div>
    );
  }
  return (
    <div className="share-leader">
      {top.map(r => {
        return (
          <div className="share-leader-row" key={r.key}>
            <img src={r.img} alt="" loading="lazy" />
            <div className="share-leader-meta">
              <span className="share-leader-name">{r.campaign && <em className="campaign-chip">{t("حملة")}</em>}{r.name}</span>
              <i className="share-leader-track"><b style={{ width: `${Math.max(10, (r.count / max) * 100)}%` }} /></i>
            </div>
            <div className="share-leader-side">
              <b className="share-leader-count">{r.count} <small>{t("مشاركة")}</small></b>
              {r.delta !== 0 && (
                <span className={`share-delta ${r.delta > 0 ? "up" : "down"}`} title={r.delta > 0 ? t("مقارنة بالأسبوع الماضي") : t("انخفاض مقارنة بالأسبوع الماضي")}>
                  {r.delta > 0 ? "▲" : "▼"} +{r.delta} {t("هذا الأسبوع")}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Settings
function SettingsSection() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const t = useAdminT();
  useEffect(() => {
    api<{ settings: Record<string, string> }>("/api/admin/settings").then(d => setSettings(d.settings || {})).catch(() => undefined);
    api<{ products: Product[] }>("/api/admin/products").then(d => setProducts(d.products)).catch(() => undefined);
    api<{ orders: OrderRecord[] }>("/api/admin/orders").then(d => setOrders(d.orders)).catch(() => undefined);
  }, []);
  const update = (key: string, value: string) => setSettings({ ...settings, [key]: value });
  const save = async () => {
    try {
      await api("/api/admin/settings", post("/api/admin/settings", {
        whatsappNumber: settings.whatsappNumber,
        announcementAr: settings.announcementAr,
        announcementEn: settings.announcementEn,
        freeShippingThreshold: Number(settings.freeShippingThreshold || 900),
        shippingFee: Number(settings.shippingFee || 60),
      }));
      toast.success(t("تم حفظ الإعدادات"));
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الحفظ")); }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ settings, products, orders }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "lubnel-backup.json"; a.click();
    toast.success(t("تم تصدير النسخة الاحتياطية"));
  };
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("الإعدادات")}</h2><p>{t("بيانات المتجر الأساسية: رقم واتساب، الشريط العلوي، ورسوم الشحن.")}</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="tool-button" onClick={exportData}><Upload size={16} /> {t("تصدير نسخة احتياطية")}</button>
          <button className="button button-dark" onClick={save}><Check size={16} /> {t("حفظ")}</button>
        </div>
      </div>
      <div className="panel settings-panel">
        <div className="two-fields">
          <label>{t("رقم واتساب للطلبات")}<input value={settings.whatsappNumber || ""} onChange={e => update("whatsappNumber", e.target.value)} placeholder="201000000000" /></label>
          <label>{t("الدومين")}<input value={settings.domain || "lubnel.com"} onChange={e => update("domain", e.target.value)} /></label>
        </div>
        <div className="two-fields">
          <label>{t("الشريط العلوي (عربي)")}<input value={settings.announcementAr || ""} onChange={e => update("announcementAr", e.target.value)} /></label>
          <label>{t("الشريط العلوي (إنجليزي)")}<input value={settings.announcementEn || ""} onChange={e => update("announcementEn", e.target.value)} /></label>
        </div>
        <div className="two-fields">
          <label>{t("حد الشحن المجاني")}<input type="number" value={settings.freeShippingThreshold || 900} onChange={e => update("freeShippingThreshold", e.target.value)} /></label>
          <label>{t("رسوم الشحن")}<input type="number" value={settings.shippingFee || 60} onChange={e => update("shippingFee", e.target.value)} /></label>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Users & roles
type AdminUserRow = { id: number; username: string; displayName: string; role: string; customRole: string | null; permissions: string; active: boolean; lastLoginAt: string | null };
function UsersSection() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [roles, setRoles] = useState<{ id: number; roleName: string; permissions: string }[]>([]);
  const [sessions, setSessions] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", verificationCode: "", role: "staff", permissions: [] as string[] });
  const [newRole, setNewRole] = useState({ roleName: "", permissions: [] as string[] });
  const t = useAdminT();
  const ar = useAdminAr();
  const dateLocale = useAdminDateLocale();
  const load = useCallback(() => {
    api<{ users: AdminUserRow[]; roles: { id: number; roleName: string; permissions: string }[]; activeSessions: number }>("/api/admin/users")
      .then(d => { setUsers(d.users); setRoles(d.roles); setSessions(d.activeSessions); })
      .catch(e => toast.error(e instanceof Error ? e.message : t("فشل التحميل")));
  }, [t]);
  useEffect(() => { load(); }, [load]);
  const createUser = async () => {
    if (!form.username || !form.password || !form.verificationCode) return toast.error(t("أكملي بيانات المستخدم"));
    try {
      await api("/api/admin/users", post("/api/admin/users", form));
      toast.success(t("تمت إضافة المستخدم بالصلاحيات المحددة"));
      setShowForm(false);
      setForm({ username: "", displayName: "", password: "", verificationCode: "", role: "staff", permissions: [] });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الإنشاء")); }
  };
  const toggleUser = async (u: AdminUserRow) => {
    try { await api("/api/admin/users", post("/api/admin/users", { action: "update", id: u.id, active: !u.active })); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("فشل التحديث")); }
  };
  const removeUser = async (u: AdminUserRow) => {
    if (!window.confirm(ar ? `تعطيل ${u.displayName} نهائيًا؟` : `Disable ${u.displayName} permanently?`)) return;
    try { await api("/api/admin/users", post("/api/admin/users", { action: "remove", id: u.id })); toast.success(t("تم تعطيل المستخدم")); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("فشل التعطيل")); }
  };
  const createRole = async () => {
    if (!newRole.roleName) return toast.error(t("أدخلي اسم الدور"));
    try {
      await api("/api/admin/roles", post("/api/admin/roles", newRole));
      toast.success(t("تم حفظ الدور المخصص"));
      setNewRole({ roleName: "", permissions: [] });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("فشل الحفظ")); }
  };
  const togglePerm = (list: string[], perm: string) => list.includes(perm) ? list.filter(p => p !== perm) : [...list, perm];
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("المستخدمون والأدوار")} <small>{users.length}</small></h2><p>{t("تسلسل هرمي كامل: Owner، Admin، Moderator، Staff — بصلاحيات دقيقة وجلسات مشفرة.")} <b>{t("الجلسات النشطة الآن:")} {sessions}</b></p></div>
        <button className="button button-dark" onClick={() => setShowForm(!showForm)}><Plus size={16} /> {t("إضافة مستخدم")}</button>
      </div>
      {showForm && (
        <div className="panel coupon-form">
          <div className="two-fields">
            <label>{t("اسم المستخدم")}<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="editor_1" /></label>
            <label>{t("الاسم الظاهر")}<input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="سارة محمود" /></label>
          </div>
          <div className="two-fields">
            <label>{t("كلمة المرور")}<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={t("8 أحرف على الأقل")} /></label>
            <label>{t("كود التحقق")}<input value={form.verificationCode} onChange={e => setForm({ ...form, verificationCode: e.target.value })} placeholder={t("كود خاص")} /></label>
          </div>
          <label>{t("الدور")}
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin</option><option value="moderator">Moderator</option><option value="staff">Staff</option>
            </select>
          </label>
          <div className="perm-grid">
            {ADMIN_PERMISSIONS.map(perm => (
              <label key={perm} className={`filter-check ${form.permissions.includes(perm) ? "checked" : ""}`}>
                <span>{form.permissions.includes(perm) ? <Check size={12} /> : null}</span>
                <input type="checkbox" checked={form.permissions.includes(perm)} onChange={() => setForm({ ...form, permissions: togglePerm(form.permissions, perm) })} />
                {perm}
              </label>
            ))}
          </div>
          <div className="modal-actions"><button className="button button-dark" onClick={createUser}><Check size={16} /> {t("حفظ المستخدم")}</button></div>
        </div>
      )}
      <div className="panel admin-users-panel">
        <div className="admin-table">
          <div className="table-row table-label"><span>{t("المستخدم")}</span><span>{t("الدور")}</span><span>{t("الصلاحيات")}</span><span>{t("آخر دخول")}</span><span>{t("الحالة")}</span><span /></div>
          {users.map(u => (
            <div className="table-row" key={u.id}>
              <span className="customer-cell"><span className="customer-avatar">{u.displayName[0]}</span>{u.displayName}<small>{u.username}</small></span>
              <span>{u.role === "owner" ? "Owner" : u.role}{u.customRole ? ` · ${u.customRole}` : ""}</span>
              <span>{u.role === "owner" ? t("كل الصلاحيات") : `${(() => { try { return JSON.parse(u.permissions).length; } catch { return 0; } })()} ${t("صلاحية")}`}</span>
              <span>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(dateLocale) : "—"}</span>
              <span><em className={`status ${u.active ? "status-live" : "status-cancelled"}`}>{u.active ? t("نشط") : t("معطل")}</em></span>
              <span className="row-actions">
                {u.role !== "owner" && <button onClick={() => toggleUser(u)} title={u.active ? t("تعطيل") : t("تنشيط")}><ShieldCheck size={15} /></button>}
                {u.role !== "owner" && <button onClick={() => removeUser(u)} title={t("تعطيل نهائي")}><Trash2 size={15} /></button>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="content-head" style={{ marginTop: 20 }}>
        <div><h2>{t("الأدوار المخصصة")} <small>{roles.length}</small></h2></div>
      </div>
      <div className="panel coupon-form">
        <div className="two-fields">
          <label>{t("اسم الدور")}<input value={newRole.roleName} onChange={e => setNewRole({ ...newRole, roleName: e.target.value })} placeholder={t("محررة محتوى")} /></label>
        </div>
        <div className="perm-grid">
          {ADMIN_PERMISSIONS.map(perm => (
            <label key={perm} className={`filter-check ${newRole.permissions.includes(perm) ? "checked" : ""}`}>
              <span>{newRole.permissions.includes(perm) ? <Check size={12} /> : null}</span>
              <input type="checkbox" checked={newRole.permissions.includes(perm)} onChange={() => setNewRole({ ...newRole, permissions: togglePerm(newRole.permissions, perm) })} />
              {perm}
            </label>
          ))}
        </div>
        <div className="modal-actions"><button className="button button-outline" onClick={createRole}><Users size={16} /> {t("حفظ الدور")}</button></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Audit
type AuditRow = { id: number; actorUsername: string; action: string; entity: string; entityId: string | null; ip: string | null; device: string | null; userAgent: string | null; createdAt: string };
const AUDIT_PER_PAGE = 14;
function AuditSection() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [ip, setIp] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const t = useAdminT();
  const dateLocale = useAdminDateLocale();
  const load = useCallback(() => {
    api<{ logs: AuditRow[] }>(`/api/admin/audit${ip ? `?ip=${encodeURIComponent(ip)}` : ""}`).then(d => setLogs(d.logs)).catch(() => undefined);
  }, [ip]);
  useEffect(() => { load(); }, [load]);
  const filtered = logs.filter(l => `${l.action} ${l.entity} ${l.actorUsername} ${l.entityId || ""}`.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / AUDIT_PER_PAGE));
  const safePage = Math.min(page, pages);
  const pagedLogs = filtered.slice((safePage - 1) * AUDIT_PER_PAGE, safePage * AUDIT_PER_PAGE);
  return (
    <div className="admin-content">
      <div className="content-head">
        <div><h2>{t("سجل التدقيق")} <small>{logs.length}</small></h2><p>{t("كل تصرف إداري مع الوقت، المستخدم، IP، المتصفح والجهاز. ابحثي عن طلبات نفس الـIP.")}</p></div>
        <div className="content-head-actions">
          <div className="admin-search admin-search-full"><Search size={16} /><input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder={t("بحث بالتصرف أو الكيان أو المستخدم")} /></div>
          <div className="admin-search"><Search size={16} /><input value={ip} onChange={e => { setIp(e.target.value); setPage(1); }} placeholder={t("بحث بالـIP")} /></div>
        </div>
      </div>
      <div className="panel">
        <div className="admin-table audit-table">
          <div className="table-row table-label"><span>{t("التاريخ")}</span><span>{t("المستخدم")}</span><span>{t("التصرف")}</span><span>{t("الكيان")}</span><span>{t("IP / الجهاز")}</span></div>
          {pagedLogs.map(log => (
            <div className="table-row" key={log.id}>
              <span>{new Date(log.createdAt).toLocaleString(dateLocale)}</span>
              <span>{log.actorUsername}</span>
              <span>{log.action === "order.cancel_requested" ? <em className="cancel-flag" style={{ margin: 0 }}>{t("طلب إلغاء من عميلة")}</em> : log.action === "order.cancel_approved" ? <em className="cancel-flag cancel-approved-flag" style={{ margin: 0 }}>{t("✓ قبول إلغاء الطلب")}</em> : log.action === "order.cancel_rejected" ? <em className="audit-keep-flag" style={{ margin: 0 }}>{t("استمرار الطلب")}</em> : log.action === "review.approved" ? <em className="audit-review-flag" style={{ margin: 0 }}>{t("★ نشر تقييم")}</em> : log.action === "review.unpublished" ? <em className="audit-review-flag muted" style={{ margin: 0 }}>{t("إخفاء تقييم")}</em> : log.action === "review.featured" ? <em className="audit-review-flag featured" style={{ margin: 0 }}>{t("📌 تثبيت بالرئيسية")}</em> : log.action === "review.unfeatured" ? <em className="audit-review-flag muted" style={{ margin: 0 }}>{t("إزالة من الرئيسية")}</em> : log.action === "review.deleted" ? <em className="audit-review-flag danger" style={{ margin: 0 }}>{t("حذف تقييم")}</em> : log.action}</span>
              <span>{log.entity} {log.entityId || ""}</span>
              <span>{log.ip || "unknown"}<small>{log.device} · {log.userAgent?.slice(0, 42)}</small></span>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-state"><ScrollText size={22} /><p>{t("لا توجد سجلات مطابقة.")}</p></div>}
        </div>
        <PaginationBar page={safePage} pages={pages} total={filtered.length} onPage={setPage} label="سجل" />
      </div>
    </div>
  );
}

// re-export for shell
export { ArrowUpRight, Heart, ShoppingBag, Mail, Phone, MapPin };
