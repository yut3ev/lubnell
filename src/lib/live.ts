// Best-effort event emission to the LUBNÉL live service (mini-services/lubnel-live).
// The service broadcasts to the admin studio over socket.io (port 3010 via gateway,
// HTTP emit API on 127.0.0.1:3011 server-to-server). Emission NEVER breaks the
// main API flow — all failures are swallowed with a console warning.

const LIVE_EMIT_URL = "http://127.0.0.1:3011/emit";
const LIVE_SECRET = process.env.LUBNEL_LIVE_SECRET || "lubnel-live-internal";

export type LiveEvent =
  | "order:new"
  | "order:cancel_requested"
  | "order:status_changed"
  | "order:cancel_resolved"
  | "review:new"
  | "review:moderated"
  | "review:helpful"
  | "product:changed";

export async function emitLive(event: LiveEvent, data: Record<string, unknown>): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(LIVE_EMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lubnel-live-secret": LIVE_SECRET,
      },
      body: JSON.stringify({ event, data }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok && res.status !== 401) {
      console.warn(`[live] emit ${event} -> ${res.status}`);
    }
  } catch {
    // live service not running or timeout — ignore silently
  }
}
