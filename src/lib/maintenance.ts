// U77-MAINTENANCE-MODE — the owner's site open/close switch.
//
// Studio → الإعدادات → بيانات المتجر → «حالة الموقع» saves a StoreSettings
// row key='maintenance' ({ enabled, message, updatedAt }). The storefront
// layout reads it on EVERY request: when enabled, visitors get ONLY the
// branded maintenance screen (no header/footer/products), while the admin
// panel keeps working so she can re-open the site. Order creation is also
// gated (503) so a stale tab can't checkout while the store is closed.
//
// Fail-open contract: any settings/DB hiccup resolves to OPEN — a broken
// settings read must never lock the whole storefront by accident.
import { getSettingRow } from "@/lib/settings-cache";

export type MaintenanceState = {
  enabled: boolean;
  /** Custom Arabic message shown under the title (owner-editable). */
  message: string;
  updatedAt: string | null;
};

/** Default sub-line on the maintenance screen when she didn't write one. */
export const DEFAULT_MAINTENANCE_MESSAGE =
  "نقوم حاليًا بأعمال صيانة وتطوير للموقع — نرجع قريبًا جدًا 🌸";

/** Cached (10s TTL + invalidated on admin saves) read of the maintenance row. */
export async function getMaintenanceState(): Promise<MaintenanceState> {
  try {
    const row = await getSettingRow("maintenance");
    if (!row) return { enabled: false, message: "", updatedAt: null };
    let val: Record<string, unknown> = {};
    try {
      val = (JSON.parse(row.value) as Record<string, unknown>) || {};
    } catch {
      val = {};
    }
    return {
      enabled: val.enabled === true,
      message: typeof val.message === "string" ? val.message.trim() : "",
      updatedAt: typeof val.updatedAt === "string" ? val.updatedAt : null,
    };
  } catch {
    // fail-open — never lock the storefront because of an infra blip
    return { enabled: false, message: "", updatedAt: null };
  }
}
