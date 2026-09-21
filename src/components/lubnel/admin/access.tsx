"use client";

// Admin access gate: session check, standalone login, first-time owner setup
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { AdminProfile } from "@/lib/lubnel-types";
import { readStoredAdminLang, translate, type AdminLang } from "@/lib/admin-i18n";

// Login persists its own lang choice (same key as the studio), and mirrors the
// studio's dir so the gate and the dashboard never disagree.
function useLoginLang(): { lang: AdminLang; t: (s: string) => string; ar: boolean } {
  // Lazy initializer — this gate only mounts client-side after the auth check,
  // so reading localStorage at first render is hydration-safe.
  const [lang] = useState<AdminLang>(() => readStoredAdminLang());
  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    return () => { document.documentElement.dir = "rtl"; document.documentElement.lang = "ar"; };
  }, [lang]);
  return { lang, t: (s: string) => translate(lang, s), ar: lang === "ar" };
}

type MeState =
  | { status: "loading" }
  | { status: "login"; ownerExists: boolean }
  | { status: "ready"; admin: AdminProfile };

export function useAdminMe(refreshKey: number) {
  const [state, setState] = useState<MeState>({ status: "loading" });
  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth", { cache: "no-store" });
      const data = await res.json();
      if (data.authenticated && data.admin) setState({ status: "ready", admin: data.admin });
      else setState({ status: "login", ownerExists: !!data.ownerExists });
    } catch {
      setState({ status: "login", ownerExists: false });
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch, refreshKey]);
  return { state, refetch };
}

export function AdminLogin({ onSuccess, ownerExists }: { onSuccess: () => void; ownerExists: boolean }) {
  const [setup, setSetup] = useState(!ownerExists);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { t, ar } = useLoginLang();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          setup
            ? { action: "setup-owner", username, displayName, password, verificationCode: code }
            : { action: "login", username, password, verificationCode: code },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("فشل الطلب"));
      if (setup) {
        toast.success(t("تم إنشاء حساب Owner بنجاح"));
        setSetup(false);
        // auto-login after setup
        const loginRes = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", username, password, verificationCode: code }),
        });
        if (loginRes.ok) { toast.success(t("تم تسجيل دخول الإدارة")); onSuccess(); }
      } else {
        toast.success(t("تم تسجيل دخول الإدارة"));
        onSuccess();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("فشل الطلب"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login-page" dir={ar ? "rtl" : "ltr"}>
      <div className="admin-login-panel">
        <div className="admin-login-brand"><span className="brand-symbol">L</span><span>LUBNÉL <small>CONTROL CENTER</small></span></div>
        <div className="admin-login-icon"><ShieldCheck size={25} /></div>
        <span className="eyebrow">PRIVATE ADMIN ACCESS</span>
        <h1>{setup ? t("إنشاء حساب Owner") : t("دخول لوحة الإدارة")}</h1>
        <p>{setup
          ? t("هذه الخطوة تظهر مرة واحدة فقط. اختاري بيانات Owner التي لا يملكها أي شخص آخر.")
          : t("دخول مستقل عن حساب المتجر. استخدمي اليوزر والباسورد وكود التحقق الخاص بكِ.")}</p>
        <form onSubmit={submit}>
          {setup && (
            <label>{t("الاسم الظاهر")}
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t("اسم Owner")} required />
            </label>
          )}
          <label><UserRound size={15} /> {t("اسم المستخدم")}
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="owner" autoComplete="username" required />
          </label>
          <label><LockKeyhole size={15} /> {t("كلمة المرور")}
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("8 أحرف على الأقل")} autoComplete={setup ? "new-password" : "current-password"} required />
          </label>
          <label><KeyRound size={15} /> {t("كود التحقق الخاص بك")}
            <input value={code} onChange={e => setCode(e.target.value)} placeholder={t("اختاري كودًا لا يُنسى")} required />
          </label>
          <button className="button button-dark full" disabled={busy}>{setup ? t("إنشاء Owner") : t("دخول آمن")}<ArrowLeft size={16} /></button>
        </form>
        <div className="admin-login-footer">
          <span>{t("Owner فقط يملك صلاحيات المستخدمين والأدوار")}</span>
          {ownerExists && <button onClick={() => setSetup(!setup)}>{setup ? t("لدي حساب بالفعل") : t("إعداد Owner لأول مرة")}</button>}
        </div>
      </div>
    </main>
  );
}
