// U77-MAINTENANCE-MODE — the ONLY thing visitors see while the store is closed.
//
// Owner's brief: «لو قفلته ميظهرش اي حاجه غير صفحه فيها الخدمه غير متاحه
// حاليا يتم الصيانه … والايقون تبقا ظاهرة وتحتها الكلام او فوقها بشكل
// احترافي» — so: a brand-colored animated gear emblem (pure CSS, no JS),
// the LUBNÉL wordmark above it, then the headline + her custom message.
// Responsive from 320px phones to desktop, honors prefers-reduced-motion,
// and fails graceful (static icon) on old browsers.
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/maintenance";
import { resolveVideoSource } from "@/lib/video-embed";

type Props = {
  /** Owner-written custom message (Studio → حالة الموقع). */
  message?: string;
  /** Brand row logo override; falls back to the shipped artwork. */
  logoDark?: string;
  /** U78 — emblem video (her own animation). Wins over the CSS gear. */
  video?: string;
};

const CSS = `
@keyframes mtn-spin { to { transform: rotate(360deg); } }
@keyframes mtn-spin-rev { to { transform: rotate(-360deg); } }
@keyframes mtn-pulse { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.14); opacity: .18; } }
@keyframes mtn-twinkle { 0%,100% { transform: scale(1) rotate(0deg); opacity: .95; } 50% { transform: scale(.7) rotate(20deg); opacity: .45; } }
@keyframes mtn-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes mtn-float { from { transform: translate(0, 0); } to { transform: translate(14px, 20px); } }
.mtn-spin { animation: mtn-spin 16s linear infinite; }
.mtn-spin-ring { animation: mtn-spin 46s linear infinite; }
.mtn-spin-rev { animation: mtn-spin-rev 11s linear infinite; }
.mtn-pulse { animation: mtn-pulse 3.4s ease-in-out infinite; }
.mtn-twinkle { animation: mtn-twinkle 2.6s ease-in-out infinite; }
.mtn-blob { animation: mtn-float 9s ease-in-out infinite alternate; }
.mtn-blob-slow { animation: mtn-float 13s ease-in-out infinite alternate-reverse; }
.mtn-rise { animation: mtn-rise .7s cubic-bezier(.2,.7,.3,1) both; }
.mtn-d1 { animation-delay: .12s; }
.mtn-d2 { animation-delay: .26s; }
.mtn-d3 { animation-delay: .42s; }
@media (prefers-reduced-motion: reduce) {
  .mtn-spin, .mtn-spin-ring, .mtn-spin-rev, .mtn-pulse, .mtn-twinkle,
  .mtn-blob, .mtn-blob-slow, .mtn-rise { animation: none; }
}`;

/** 8-tooth gear built from rounded rects + hub — crisp at any size. */
function Gear({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden fill="currentColor">
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="45.5" y="2" width="9" height="20" rx="4" transform={`rotate(${i * 45} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="31" />
      <circle cx="50" cy="50" r="13" fill="var(--mtn-bg, #faf6f1)" />
    </svg>
  );
}

/** Soft 4-point sparkle that twinkles above the gears. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden fill="currentColor">
      <path d="M50 2C55 34 66 45 98 50 66 55 55 66 50 98 45 66 34 55 2 50 34 45 45 34 50 2Z" />
    </svg>
  );
}

export function MaintenanceScreen({ message, logoDark, video }: Props) {
  const sub = (message || "").trim() || DEFAULT_MAINTENANCE_MESSAGE;
  const emblemVideo = (video || "").trim();
  // U82 — a YouTube/Vimeo link becomes a 16:9 embed; a direct file plays at
  // full natural size (no crop, clamped to the viewport); empty → CSS gear
  const source = resolveVideoSource(emblemVideo);
  return (
    <div
      dir="rtl"
      className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#faf6f1] px-6 py-16 text-center"
    >
      <style href="lubnel-maintenance" precedence="high" dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* soft decorative blobs in the brand color */}
      <div aria-hidden className="mtn-blob pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden className="mtn-blob-slow pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

      {/* wordmark above the emblem — «الايقون … وتحتها الكلام او فوقها» */}
      <img
        src={logoDark || "/brand/logo-dark.png"}
        alt="LUBNÉL"
        className="mtn-rise mb-10 h-9 w-auto opacity-90 sm:h-11"
      />

      {/* the emblem: her own animation when set — a YouTube/Vimeo link renders
          as a 16:9 embed, a direct file plays full-width at its natural aspect
          (never cropped, capped to the viewport), the CSS gear stays behind as
          a graceful fallback for undecodable files, else the animated gear */}
      {source.kind === "youtube" || source.kind === "vimeo" ? (
        <div className="mtn-rise relative mb-8 mx-auto w-full max-w-lg sm:mb-10 sm:max-w-2xl lg:max-w-3xl">
          <div
            className="relative w-full overflow-hidden rounded-2xl bg-black/5 shadow-xl ring-1 ring-black/5"
            style={{ aspectRatio: "16 / 9" }}
          >
            <iframe
              src={source.src}
              title="أيقونة الصيانة"
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      ) : source.kind === "file" ? (
        <div className="mtn-rise relative mb-8 mx-auto w-full max-w-lg sm:mb-10 sm:max-w-2xl lg:max-w-3xl">
          <div className="relative grid place-items-center">
            <div aria-hidden className="mtn-spin absolute inset-0 grid place-items-center text-primary/40">
              <Gear className="h-20 w-20 sm:h-24 sm:w-24" />
            </div>
            <video
              src={source.src}
              autoPlay
              loop
              muted
              playsInline
              disablePictureInPicture
              controls={false}
              preload="auto"
              className="relative max-h-[70vh] w-full object-contain drop-shadow-xl"
            />
          </div>
        </div>
      ) : (
        <div
          role="img"
          aria-label="أيقونة الصيانة"
          className="mtn-rise relative mb-9 grid h-36 w-36 place-items-center sm:h-44 sm:w-44"
        >
          <div aria-hidden className="mtn-pulse absolute inset-0 rounded-full bg-primary/15" />
          <div aria-hidden className="mtn-spin-ring absolute inset-1 rounded-full border-2 border-dashed border-primary/25" />
          <div aria-hidden className="mtn-spin absolute inset-0 grid place-items-center text-primary/85">
            <Gear className="h-20 w-20 sm:h-24 sm:w-24" />
          </div>
          <div
            aria-hidden
            className="mtn-spin-rev absolute -bottom-1 -left-1 grid h-12 w-12 place-items-center rounded-full bg-white text-primary shadow-md ring-1 ring-primary/15 sm:h-14 sm:w-14"
            style={{ ["--mtn-bg" as string]: "#ffffff" }}
          >
            <Gear className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <Sparkle className="mtn-twinkle absolute -right-2 -top-2 h-8 w-8 text-primary sm:h-9 sm:w-9" />
        </div>
      )}

      {/* the copy — headline first, then the owner's message under it */}
      <h1 className="mtn-rise mtn-d1 text-2xl font-black leading-snug tracking-tight text-[#43242b] sm:text-4xl sm:leading-tight">
        الخدمة غير متاحة حاليًا
      </h1>
      <p className="mtn-rise mtn-d2 mt-4 max-w-md text-sm leading-7 text-[#8a6f75] sm:mt-5 sm:text-lg sm:leading-8">
        {sub}
      </p>

      <div aria-hidden className="mtn-rise mtn-d3 mt-9 flex items-center justify-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/55" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/35" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/20" />
      </div>
      <p className="mtn-rise mtn-d3 mt-6 text-xs text-[#b09aa0] sm:text-sm">شكرًا لتفهمكم 🌸</p>
    </div>
  );
}
