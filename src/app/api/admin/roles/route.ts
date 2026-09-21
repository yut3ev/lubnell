// Admin roles (custom role permission presets)
import { db } from "@/lib/db";
import { jsonOk, jsonError, parseBody, requireAdmin, audit } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireAdmin(req, "users.read");
  if (!ctx) return jsonError("غير مصرح", 401);
  const roles = await db.rolePermission.findMany({ orderBy: { roleName: "asc" } });
  return jsonOk({ roles });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req, "roles.write");
  if (!ctx) return jsonError("غير مصرح", 401);
  const { roleName, permissions } = await parseBody<{ roleName?: string; permissions?: string[] }>(req);
  const name = (roleName || "").trim();
  if (name.length < 2) return jsonError("اسم الدور قصير جدًا");
  try {
    await db.rolePermission.upsert({
      where: { roleName: name },
      create: { roleName: name, permissions: JSON.stringify(permissions || []), createdBy: ctx.admin.id },
      update: { permissions: JSON.stringify(permissions || []) },
    });
    await audit(ctx, "role.saved", "role", name);
    return jsonOk({ success: true });
  } catch {
    return jsonError("تعذر حفظ الدور", 500);
  }
}
