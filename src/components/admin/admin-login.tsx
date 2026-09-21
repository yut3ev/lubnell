'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, UserRound } from 'lucide-react';
import { apiJson, saveAdminToken } from './helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * U10-ADMINLOGIN — branded owner access screen (owner: «شكلها مش احترافي»).
 * Real LUBNÉL wordmark, hairline gradient card, blur-orb backdrop.
 * RTL trap: inputs are dir="ltr", so trailing icons must use PHYSICAL
 * right-* / pr-10 / pl-3.5 — logical pe-* would drop the icon on the LEFT
 * edge on top of the text. Auth flow/API contract untouched.
 */
export default function AdminLogin({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [checked, setChecked] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<{ ok: boolean; hasOwner: boolean }>('/api/admin/has-owner').then(({ data }) => {
      if (data && data.ok && !data.hasOwner) setMode('setup');
      setChecked(true);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const url = mode === 'setup' ? '/api/admin/setup' : '/api/admin/login';
    const body = mode === 'setup' ? { username, displayName, password, verificationCode: code } : { username, password, verificationCode: code };
    const { ok, data } = await apiJson<{ ok: boolean; error?: string; token?: string }>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!ok || !data?.ok) {
      setError(data?.error || 'حدث خطأ غير متوقع');
      return;
    }
    // Persist the session token so cookie-blocked contexts (preview iframes)
    // keep working via the x-admin-token header on every apiJson call.
    if (data.token) saveAdminToken(data.token);
    onDone();
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: 'linear-gradient(165deg, #fdf8f5 0%, #f9ece5 48%, #f3ddd2 100%)' }}
    >
      {/* ambient blur orbs */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="animate-in fade-in slide-in-from-bottom-3 overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/95 shadow-2xl shadow-rose-950/10 backdrop-blur duration-500">
          {/* hairline gradient top */}
          <div aria-hidden className="h-1 w-full bg-gradient-to-l from-primary/70 via-primary/30 to-primary/70" />

          <div className="p-7 sm:p-8">
            {/* brand mark */}
            <div className="flex flex-col items-center">
              <img
                src="/brand/logo-dark.png"
                alt="LUBNÉL"
                className="h-11 w-auto rounded-lg"
                draggable={false}
              />
              <span className="mt-3 text-[10px] font-black tracking-[0.35em] text-muted-foreground" dir="ltr">
                ADMIN ACCESS
              </span>
            </div>

            <div className="mt-5 text-center">
              <h1 className="text-2xl font-black tracking-tight">
                {mode === 'setup' ? 'إعداد حساب المالك' : 'تسجيل دخول الإدارة'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {mode === 'setup'
                  ? 'خطوة لمرة واحدة — أنشئي حساب المالك بكود تحقق لا يملكه غيرك.'
                  : 'أدخلي بياناتك للوصول إلى لوحة تحكم المتجر.'}
              </p>
            </div>

            <form onSubmit={submit} className="mt-6 grid gap-4">
              {mode === 'setup' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="displayName" className="text-[13px] font-bold">الاسم الظاهر</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="اسم المالك"
                    required
                    className="h-11 rounded-xl"
                  />
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="username" className="text-[13px] font-bold">اسم المستخدم</Label>
                <div className="relative">
                  <Input
                    id="username"
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="owner"
                    autoComplete="username"
                    className="h-11 rounded-xl pl-3.5 pr-10 text-left"
                    required
                  />
                  <UserRound aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-[13px] font-bold">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    dir="ltr"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8 أحرف على الأقل"
                    autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                    className="h-11 rounded-xl pl-3.5 pr-10 text-left"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="code" className="text-[13px] font-bold">كود الأمان</Label>
                <div className="relative">
                  <Input
                    id="code"
                    dir="ltr"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="كود التحقق الخاص بكِ"
                    className="h-11 rounded-xl pl-3.5 pr-10 text-left"
                    required
                  />
                  <KeyRound aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive">
                  <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" disabled={busy} className="mt-1 h-12 rounded-xl bg-primary text-base font-black text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/95 hover:shadow-xl active:scale-[0.99]">
                {busy ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    جاري التحقق…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === 'setup' ? 'إنشاء الحساب' : 'دخول آمن'}
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </Button>
            </form>
          </div>

          {/* protected-area footer bar */}
          <div className="flex items-center justify-between border-t border-border/60 bg-secondary/40 px-6 py-3.5 text-xs text-muted-foreground">
            <span className="font-semibold">منطقة محمية — لفريق لوبنيل فقط</span>
            {checked && (
              <button
                type="button"
                className="font-bold text-primary transition-opacity hover:opacity-75"
                onClick={() => {
                  setMode(mode === 'setup' ? 'login' : 'setup');
                  setError('');
                }}
              >
                {mode === 'setup' ? 'لدي حساب بالفعل' : 'إعداد المالك'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs font-semibold text-muted-foreground transition-colors hover:text-primary">
            ← العودة إلى المتجر
          </Link>
        </div>
      </div>
    </div>
  );
}
