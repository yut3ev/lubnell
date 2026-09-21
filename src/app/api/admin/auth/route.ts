// Admin auth: GET (me + setup status), POST actions: login | logout | setup-owner
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import {
  ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_MS, AdminLockoutError,
  createOwner, destroyAdminSession, getAdminFromRequest,
  hasOwner, loginAdmin, permissionsFor,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureSeed();
    const [ownerExists, admin] = await Promise.all([hasOwner(), getAdminFromRequest(req)]);
    if (!admin) return jsonOk({ authenticated: false, ownerExists });
    return jsonOk({
      authenticated: true,
      ownerExists,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
        customRole: admin.customRole,
        permissions: permissionsFor(admin),
      },
    });
  } catch (error) {
    console.error("admin me failed", error);
    return jsonOk({ authenticated: false, ownerExists: false });
  }
}

export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await parseBody<{ action?: string; username?: string; password?: string; verificationCode?: string; displayName?: string }>(req);

    if (body.action === "logout") {
      await destroyAdminSession(req);
      const jar = await cookies();
      jar.set(ADMIN_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: -1 });
      return jsonOk({ success: true });
    }

    if (body.action === "setup-owner") {
      try {
        const admin = await createOwner(
          {
            username: String(body.username || ""),
            displayName: String(body.displayName || ""),
            password: String(body.password || ""),
            verificationCode: String(body.verificationCode || ""),
          },
          { ip: req.headers.get("x-forwarded-for") || "unknown", userAgent: req.headers.get("user-agent") || "unknown", device: "unknown" },
        );
        return jsonOk({ success: true, admin: { id: admin.id, username: admin.username, role: admin.role } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "FAILED";
        const map: Record<string, string> = {
          OWNER_ALREADY_EXISTS: "يوجد Owner بالفعل",
          INVALID_USERNAME: "اسم المستخدم غير صالح (3-80 حرفًا إنجليزيًا)",
          PASSWORD_TOO_SHORT: "كلمة المرور 8 أحرف على الأقل",
          INVALID_VERIFICATION_CODE: "كود التحقق من 4 إلى 32 حرفًا",
        };
        return jsonError(map[message] || "تعذر إنشاء حساب Owner", 400);
      }
    }

    // default: login
    try {
      const { token, admin } = await loginAdmin(
        { username: String(body.username || ""), password: String(body.password || ""), verificationCode: String(body.verificationCode || "") },
        { ip: req.headers.get("x-forwarded-for") || "unknown", userAgent: req.headers.get("user-agent") || "unknown", device: /Mobile|Android|iPhone|iPad/i.test(req.headers.get("user-agent") || "") ? "mobile" : "desktop" },
      );
      // Same cookie policy as /api/admin/login: SameSite=None+Secure under
      // https so embedded-preview iframes keep the session; Lax on plain http.
      const secure = (req.headers.get("x-forwarded-proto") || "").includes("https");
      const jar = await cookies();
      jar.set(ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: secure ? "none" : "lax",
        path: "/",
        maxAge: ADMIN_SESSION_TTL_MS / 1000,
        secure,
      });
      return jsonOk({
        success: true,
        admin: {
          id: admin.id, username: admin.username, displayName: admin.displayName,
          role: admin.role, customRole: admin.customRole, permissions: permissionsFor(admin),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "FAILED";
      if (message === "DATABASE_UNAVAILABLE") return jsonError("قاعدة البيانات غير متاحة", 500);
      if (err instanceof AdminLockoutError) {
        // R97: the refusal says WHY — lockedBy names the bucket(s) that bound
        // it (username | ip | both); Retry-After header matches the body;
        // credentials were NOT checked.
        const why = err.lockedBy;
        const msg =
          why === "username"
            ? `محاولات دخول كثيرة جدًا لهذا المستخدم — أعد المحاولة بعد ${err.retryAfterSeconds} ثانية`
            : why === "ip"
              ? `محاولات دخول كثيرة جدًا من هذه الشبكة — أعد المحاولة بعد ${err.retryAfterSeconds} ثانية`
              : `محاولات دخول كثيرة جدًا — أعد المحاولة بعد ${err.retryAfterSeconds} ثانية`;
        return NextResponse.json(
          { error: msg, retryAfter: err.retryAfterSeconds, lockedBy: why },
          { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } },
        );
      }
      return jsonError("بيانات الدخول أو كود التحقق غير صحيح", 401);
    }
  } catch (error) {
    console.error("admin auth failed", error);
    return jsonError("طلب غير صالح", 400);
  }
}
