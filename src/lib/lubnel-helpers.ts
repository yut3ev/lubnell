"use client";

// LUBNÉL client helpers: money, search scoring, persisted state, hash router
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Product } from "@/lib/lubnel-types";

export const money = (value: number) => `${(value ?? 0).toLocaleString("en-US")} ج.م`;

// R64 — Egyptian mobile canonicalisation. COD fulfilment runs on WhatsApp, so
// the phone IS the order's spine: a typo'd or oddly-formatted number breaks
// the owner's only contact channel. Accepts what Egyptians actually type —
// Arabic-Indic digits (٠١٢…), spaces/dashes/parens, +20 / 0020 / bare 20
// prefixes, a dropped leading 0 — and returns ONE canonical local form
// (01[0125] + 8 digits) or "" when the number can't be a reachable mobile.
export function normalizeEgyptPhone(raw: string): string {
  const arDigits = "٠١٢٣٤٥٦٧٨٩";
  let s = raw.replace(/[٠-٩]/g, d => String(arDigits.indexOf(d)));
  s = s.replace(/[\s\-().]/g, "").trim();
  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("20") && s.length >= 11) s = s.slice(2);
  if (s.startsWith("1") && s.length === 10) s = "0" + s;
  return /^01[0125]\d{8}$/.test(s) ? s : "";
}

// R65 — display companion to normalizeEgyptPhone. The canonical 11-digit
// form is what gets STORED and DIALLED, but a wall of digits is hard to read
// back against a delivery sheet, so the admin board shows the grouped shape
// Egyptians actually read (010 1234 5678). Anything non-canonical passes
// through untouched — the display never pretends a row is canonical.
export function formatEgyptPhone(p: string): string {
  return /^01[0125]\d{8}$/.test(p) ? `${p.slice(0, 3)} ${p.slice(3, 7)} ${p.slice(7)}` : p;
}

// ─── Client-side image compression before upload ───
// Downscales to fit `maxEdge` and re-encodes as WebP (JPEG fallback), typically
// cutting upload size 5-15x for phone photos. Returns the original File when
// compression isn't needed/possible (GIF, already tiny, no canvas support).
export async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<File> {
  const KEEP_TYPES = ["image/gif"];
  if (KEEP_TYPES.includes(file.type)) return file;
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  if (file.size <= 96 * 1024) return file; // already small — skip the canvas roundtrip

  try {
    const bitmapUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = bitmapUrl;
    });
    URL.revokeObjectURL(bitmapUrl);

    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const mime = canvas.toDataURL("image/webp", quality).startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, quality));
    if (!blob || blob.size >= file.size) return file; // compression didn't help

    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    const ext = mime === "image/webp" ? ".webp" : ".jpg";
    return new File([blob], `${base}${ext}`, { type: mime, lastModified: Date.now() });
  } catch {
    return file; // any failure → fall back to original
  }
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ─── localStorage-backed state (SSR-safe, lint-clean) ───
// useSyncExternalStore gives us: server snapshot = initial (hydration-safe),
// client snapshot = live localStorage value, plus free cross-tab sync.
const storageListeners = new Set<() => void>();
function notifyStorageChange() {
  for (const listener of storageListeners) listener();
}
function subscribeStorage(onChange: () => void) {
  storageListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    storageListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function usePersistedState<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  const cacheRef = useRef<{ raw: string | null; value: T }>({ raw: null, value: initial });

  const value = useSyncExternalStore(
    subscribeStorage,
    () => {
      let raw: string | null = null;
      try { raw = localStorage.getItem(key); } catch { raw = null; }
      if (raw === cacheRef.current.raw) return cacheRef.current.value;
      let parsed = initialRef.current;
      if (raw) {
        try { parsed = JSON.parse(raw) as T; } catch { parsed = initialRef.current; }
      }
      cacheRef.current = { raw, value: parsed };
      return parsed;
    },
    () => initialRef.current,
  );

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    let current = initialRef.current;
    try {
      const raw = localStorage.getItem(key);
      if (raw) current = JSON.parse(raw) as T;
    } catch { /* corrupted storage — keep initial */ }
    const resolved = typeof next === "function" ? (next as (prev: T) => T)(current) : next;
    try {
      localStorage.setItem(key, JSON.stringify(resolved));
    } catch { /* storage full/blocked */ }
    notifyStorageChange();
  }, [key]);

  return [value, setValue] as const;
}

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06ff\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Smart-search synonym expansion (Arabic ↔ English, tailored to the LUBNÉL catalog)
const SEARCH_SYNONYMS: Record<string, string[]> = {
  روج: ["lipstick", "lips", "lip", "شفايف", "احمر"],
  lipstick: ["روج", "lips", "شفايف"],
  "احمر شفاه": ["روج", "lipstick", "lips"],
  شفايف: ["lip", "lipstick", "روج"],
  lip: ["شفايف", "روج", "lipstick"],
  بوكس: ["set", "sets", "مجموعه", "box"],
  box: ["بوكس", "set", "مجموعه"],
  مجموعه: ["set", "بوكس", "box"],
  set: ["مجموعه", "بوكس"],
  معطر: ["mist", "fragrance", "عطر", "سبلاش", "body"],
  عطر: ["mist", "fragrance", "معطر"],
  mist: ["معطر", "fragrance", "عطر"],
  fragrance: ["عطر", "معطر", "mist"],
  لوشن: ["lotion", "مرطب", "body"],
  lotion: ["لوشن", "مرطب"],
  مرطب: ["لوشن", "lotion"],
  سكراب: ["scrub", "مقشر"],
  scrub: ["سكراب", "مقشر"],
  مقشر: ["scrub", "سكراب"],
  سلاسل: ["necklace", "قلادات", "stanless", "stainless", "انسيال"],
  سلسله: ["necklace", "قلادات", "stainless"],
  قلادات: ["necklace", "سلاسل", "stainless"],
  necklace: ["سلاسل", "قلادات"],
  stainless: ["ستانلس", "سلاسل", "necklace"],
  ستانلس: ["stainless", "سلاسل", "necklace"],
  شعر: ["hair", "tonic", "تونك"],
  hair: ["شعر", "tonic"],
  تونك: ["tonic", "شعر", "hair"],
  tonic: ["تونك", "شعر", "hair"],
  فراوله: ["strawberry"],
  strawberry: ["فراوله"],
  خيار: ["cucumber"],
  cucumber: ["خيار"],
  افوكادو: ["avocado"],
  avocado: ["افوكادو"],
  نجومه: ["star", "نجوم"],
  star: ["نجومه", "necklace", "سلاسل"],
  غسول: ["wash", "cleanser", "تنظيف"],
  mask: ["ماسك"],
  ماسك: ["mask"],
  رول: ["roll", "deodorant"],
  هديه: ["gift", "بوكس", "box"],
  gift: ["هديه", "بوكس"],
};

function expandQueryTokens(tokens: string[]): string[] {
  const out = new Set<string>(tokens);
  for (const token of tokens) {
    const mapped = SEARCH_SYNONYMS[token];
    if (mapped) mapped.forEach(m => out.add(m));
  }
  return [...out];
}

export function searchScore(product: Product, rawQuery: string) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return 1;
  const rawTokens = query.split(" ").filter(Boolean);
  // multi-word phrase synonyms (e.g. "احمر شفاه") + per-token expansion
  const phrases = Object.keys(SEARCH_SYNONYMS).filter(k => k.includes(" ") && query.includes(k));
  const tokens = expandQueryTokens(rawTokens);
  const haystack = normalizeSearchText(`${product.name} ${product.nameAr} ${product.category} ${product.categoryAr} ${product.description} ${product.alt} ${(product.variants || []).map(v => `${v.label} ${v.value}`).join(" ")}`);
  const name = normalizeSearchText(`${product.name} ${product.nameAr}`);
  const category = normalizeSearchText(`${product.category} ${product.categoryAr}`);
  let score = 0;
  for (const token of tokens) {
    if (name === token) score += 20;
    else if (name.startsWith(token)) score += 12;
    else if (name.includes(token)) score += 8;
    else if (category.includes(token)) score += 7;
    else if (haystack.includes(token)) score += 3;
  }
  if (haystack.includes(query)) score += 10;
  for (const phrase of phrases) {
    if (haystack.includes(phrase) || SEARCH_SYNONYMS[phrase].some(m => haystack.includes(normalizeSearchText(m)))) score += 9;
  }
  if (product.featured) score += 1;
  return score;
}

// ── Hash router ─────────────────────────────────────────────────────
export type Route =
  | { view: "home" }
  | { view: "shop"; params: URLSearchParams }
  | { view: "product"; id: string }
  | { view: "cart" }
  | { view: "wishlist" }
  | { view: "track" }
  | { view: "static"; page: string }
  | { view: "admin" }
  // R62 — unknown hashes stop pretending: the attempted path rides along so
  // the not-found screen can echo it back instead of silently re-rendering home.
  | { view: "not-found"; path: string };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = raw.split("?");
  const params = new URLSearchParams(queryPart || "");
  const segments = pathPart.split("/").filter(Boolean);
  if (segments.length === 0) return { view: "home" };
  switch (segments[0]) {
    case "shop":
      return { view: "shop", params };
    case "product":
      return { view: "product", id: decodeURIComponent(segments[1] || "") };
    case "cart":
      return { view: "cart" };
    case "track":
      return { view: "track" };
    case "wishlist":
      return { view: "wishlist" };
    case "about":
    case "contact":
    case "faq":
    case "shipping":
    case "returns":
    case "account":
      return { view: "static", page: segments[0] };
    case "admin":
      return { view: "admin" };
    default:
      // R62 — honest not-found: a stale shared link, a typo, a retired
      // campaign path — all used to land on home with zero explanation while
      // the URL still claimed somewhere else. Now the route says so.
      return { view: "not-found", path: decodeURIComponent(segments.join("/")) };
  }
}

export function useHashRoute(): [Route, (to: string) => void] {
  // Server renders "home" deterministically; real hash is adopted after hydration.
  const [route, setRoute] = useState<Route>({ view: "home" });
  useEffect(() => {
    const adopt = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };
    adopt();
    window.addEventListener("hashchange", onChangeAdapter);
    function onChangeAdapter() {
      adopt();
    }
    return () => window.removeEventListener("hashchange", onChangeAdapter);
  }, []);
  const navigate = (to: string) => {
    window.location.hash = to.startsWith("#") ? to : `#${to}`;
  };
  return [route, navigate];
}
