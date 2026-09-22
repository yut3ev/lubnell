// U73-WELCOME-UNSUBSCRIBE — shared outgoing-mail helpers.
// The newsletter campaign sender (/api/admin/newsletter/send) and the
// storefront welcome email (/api/store/subscribe) both build their transport
// from the owner's Studio SMTP card (StoreSettings key=smtp) — this module
// keeps ONE source of truth for credentials, the visible From identity
// (auth ≠ sender, see U72-SMTP-BREVO) and the Gmail-bulk-sender compliance
// headers (List-Unsubscribe / List-Unsubscribe-Post pointing at the real
// one-click endpoint).
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { STORE_URL } from "@/lib/newsletter-template";

export type SmtpSettings = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  fromName?: string;
  fromEmail?: string;
};

export type Mailer = {
  transport: import("nodemailer").Transporter;
  from: string;
  senderEmail: string;
  fromName: string;
};

/** Read the SMTP card; null when incomplete (senders must fail loudly upstream). */
export async function loadSmtp(): Promise<SmtpSettings | null> {
  const row = await db.storeSettings.findUnique({ where: { key: "smtp" } });
  let smtp: SmtpSettings = {};
  try {
    smtp = JSON.parse(row?.value || "{}") as SmtpSettings;
  } catch {
    return null;
  }
  if (!smtp.host?.trim() || !smtp.user?.trim() || !smtp.pass?.trim()) return null;
  return smtp;
}

/** nodemailer transport + the owner-facing From identity, or null when the
 *  SMTP card is not fully configured yet. */
export async function buildMailer(): Promise<Mailer | null> {
  const smtp = await loadSmtp();
  if (!smtp) return null;
  const nodemailer = (await import("nodemailer")).default;
  const port = Number(smtp.port) || 587;
  const transport = nodemailer.createTransport({
    host: smtp.host.trim(),
    port,
    secure: port === 465,
    auth: { user: smtp.user.trim(), pass: smtp.pass.trim() },
    connectionTimeout: 15_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
  const fromName = smtp.fromName?.trim() || "LUBNÉL";
  const senderEmail = smtp.fromEmail?.trim() || smtp.user.trim(); // U72 — auth ≠ sender
  return { transport, from: `"${fromName}" <${senderEmail}>`, senderEmail, fromName };
}

/* ---- one-click unsubscribe (Gmail/Yahoo bulk-sender requirement) -------- */

const UNSUB_SALT = "lubnel-nl-v1";

/** Deterministic per-address token so the endpoint can't be abused to
 *  unsubscribe arbitrary people (small-shop grade, not a security boundary). */
export function unsubToken(email: string): string {
  return createHash("sha256").update(`${email.toLowerCase()}|${UNSUB_SALT}`).digest("hex").slice(0, 32);
}

export function unsubUrlFor(email: string): string {
  return `${STORE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
}

export function listUnsubHeaders(email: string): Record<string, string> {
  const url = unsubUrlFor(email);
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
