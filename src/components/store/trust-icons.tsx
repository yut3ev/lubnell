// U64-TRUST-MOTION — animated twins of the three trust-strip icons.
// Owner: «ضف حركة بسيطة على الأيقونات اللي طلبتيهم، من غير ما أخرب البساطة»:
//  • TrustTruck — wheels spin continuously, the body does a tiny "jeans"
//    judder, and small speed lines fade in behind the rear.
//  • TrustBadge — the badge pulses gently and the check redraws itself
//    every cycle, same calm rhythm as the other two.
//  • TrustGift — the box takes a soft little hop while the bow sways.
// U64B: owner «ايزة الحركة أسرع» — all tempos doubled (durations halved),
// stagger delays scaled by the same factor so the choreography is identical.
// Geometry is copied VERBATIM from lucide-react (same paths, same 24×24
// viewBox, same stroke style) — the icons look identical, only motion was
// added. All keyframes live in globals.css under .u64-* and are fully
// disabled under prefers-reduced-motion.

import type { SVGProps } from 'react';

const stroke = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function TrustTruck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      {/* speed lines behind the rear (truck faces right → rear = left edge) */}
      <path className="u64-dash" style={{ animationDelay: '0ms' }} d="M1.4 9.5h1.4" />
      <path className="u64-dash" style={{ animationDelay: '100ms' }} d="M0.8 12.5h2" />
      <path className="u64-dash" style={{ animationDelay: '200ms' }} d="M1.4 15.5h1.4" />
      {/* body — lucide truck paths, verbatim, juddering gently */}
      <g className="u64-judder">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
        <path d="M15 18H9" />
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      </g>
      {/* wheels — tire (lucide circle) + thin hub spokes so the spin reads */}
      <g className="u64-wheel">
        <circle cx="7" cy="18" r="2" />
        <path strokeWidth={1.25} d="M7 17v2M6 18h2" />
      </g>
      <g className="u64-wheel" style={{ animationDelay: '-0.3s' }}>
        <circle cx="17" cy="18" r="2" />
        <path strokeWidth={1.25} d="M17 17v2M16 18h2" />
      </g>
    </svg>
  );
}

export function TrustBadge(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      {/* lucide badge-check paths, verbatim */}
      <path
        className="u64-badge-pulse"
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      />
      {/* pathLength=9 normalizes the dash so the CSS draw is exact */}
      <path className="u64-check-draw" pathLength={9} d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function TrustGift(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      {/* lucide gift paths, verbatim — the last path is the bow */}
      <g className="u64-gift-hop">
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13" />
        <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
        <path
          className="u64-bow"
          d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"
        />
      </g>
    </svg>
  );
}
