import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // U83-HOSTING — standalone for self-hosted runs (z.ai build.sh, local, VPS);
  // Vercel injects VERCEL and prefers its own default output.
  output: process.env.VERCEL ? undefined : "standalone",
  // U23-DEPLOY — deploy builds run INSIDE this sandbox next to the live dev
  // server (platform build.sh → bun run build). A separate distDir lets us
  // verify the production build without clobbering the dev server's .next.
  distDir: process.env.NEXT_BUILD_DIST_DIR || ".next",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // U54-PERF-ROBUST — stop advertising the framework version (X-Powered-By)
  // on every response: free hardening, zero behavior change.
  poweredByHeader: false,
  // U10-OPS — the embedded preview loads the dev server via the *.space-z.ai
  // origin; without this Next 16 flags every /_next/* asset as a cross-origin
  // dev warning and shows the «1 Issue» overlay badge to the owner.
  allowedDevOrigins: ["*.space-z.ai"],
  // U12 — hide the dev-tools «N» badge: it sat on top of the floating
  // WhatsApp button (bottom-left) and confused preview screenshots.
  devIndicators: false,
  // U20-UPLOADS — /uploads/* must NEVER be treated as a static snapshot file.
  // The owner hit "upload succeeds but the image never shows (broken image)"
  // twice: (U7) `next start` snapshots public/ at boot; (U20) the platform
  // restore dropped this rewrite and static-layer pinning broke fresh files.
  // afterFiles → any /uploads/* the static layer does not know about falls
  // through to the dynamic streaming route (disk + DB blob fallback).
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [{ source: "/uploads/:path*", destination: "/api/uploads/:path*" }],
      fallback: [],
    };
  },
  // GEO-FAQ — the FAQ moved to /faq (canonical, carries the FAQPage schema);
  // old links consolidate there so the ranking signal stays in one URL.
  async redirects() {
    return [{ source: "/info/faq", destination: "/faq", permanent: true }];
  },
  // SEC-AUDIT-1 — owner asked «هل الموقع آمن؟» (2026-09-20). Audit found the
  // app logic solid (scrypt+timingSafe auth, 5/15min lockout, guarded admin
  // APIs → live 401, uploads path-traversal guard) but ZERO security headers.
  // These are invisible (no DOM/behavior change) and standard hardening:
  // - nosniff: browsers never MIME-sniff responses into executables
  // - HSTS: browsers refuse plain-HTTP downgrade for a full year
  // - Referrer-Policy: full URLs (with order numbers) never leak to other
  //   sites via the Referer header
  // - Permissions-Policy: store has no camera/mic/geo features → deny them
  // - /admin gets X-Frame-Options SAMEORIGIN (clickjacking shield on the
  //   sensitive panel). Deliberately NOT site-wide: the platform preview
  //   legitimately embeds the storefront in a cross-origin iframe.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;

// U13: reload trigger — pick up regenerated Prisma client (Visit/VisitEvent models)
