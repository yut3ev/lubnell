// U83-HOSTING — post-build step, cross-platform and platform-aware.
// Self-hosted builds (z.ai build.sh, local, VPS) produce .next/standalone and
// need static assets copied into it. Vercel builds don't produce one — this
// is a no-op there, so a single `bun run build` works on every platform.
const fs = require('fs');

if (!fs.existsSync('.next/standalone')) {
  console.log('[post-build] no standalone bundle — skipping copy (Vercel mode)');
  process.exit(0);
}

fs.cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
fs.cpSync('public', '.next/standalone/public', { recursive: true });
console.log('[post-build] standalone assets copied');
