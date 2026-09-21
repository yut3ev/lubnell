'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Check,
  FileText,
  Heading1,
  Home,
  ImageIcon,
  LayoutDashboard,
  ListFilter,
  Loader2,
  Lock,
  Package,
  Palette,
  Pencil,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Tags,
  Ticket,
  Type,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { apiJson, fmtDate } from '../helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  permissions?: string | null; // JSON string array (staff only)
};

/* ────────────────────────────────────────────────────────────────────────────
 * U22-TEAM-PERMS — the owner asked for the team editor to carry «الاوبشن
 * واعدادات والتفاصيل والصلاحيات الي موجوده ف الادمن بالكامل بكل التفاصيل».
 * The matrix below mirrors the panel's sidebar 1:1: every section the admin
 * has, with its own granular actions (عرض/تعديل/حذف/رفع/تنفيذ), grouped the
 * way she screenshotted them. The server catalog (src/lib/admin-auth.ts
 * ADMIN_PERMISSIONS) now includes the dedicated keys each row grants:
 * dashboard.read, visits.read, theme.*, content.*, products.delete.
 * ────────────────────────────────────────────────────────────────────────── */

type PermAction = { key: string; label: string };
type PermSection = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  actions: PermAction[];
  /** rows the owner keeps for herself — visible but not grantable */
  ownerOnly?: boolean;
  note?: string;
};

const PERM_SECTIONS: { group: string; hint: string; sections: PermSection[] }[] = [
  {
    group: 'المتجر',
    hint: 'الطلبات والمنتجات والعملاء',
    sections: [
      {
        id: 'orders',
        label: 'الطلبات',
        icon: Package,
        actions: [
          { key: 'orders.read', label: 'عرض' },
          { key: 'orders.write', label: 'تعديل الحالة والتأكيد' },
        ],
      },
      {
        id: 'products',
        label: 'المنتجات',
        icon: Tags,
        actions: [
          { key: 'products.read', label: 'عرض' },
          { key: 'products.write', label: 'إضافة وتعديل' },
          { key: 'products.delete', label: 'حذف' },
        ],
      },
      {
        id: 'categories',
        label: 'الأقسام',
        icon: ListFilter,
        actions: [
          { key: 'categories.read', label: 'عرض' },
          { key: 'categories.write', label: 'إضافة وتعديل' },
        ],
      },
      {
        id: 'coupons',
        label: 'العروض والكوبونات',
        icon: Ticket,
        actions: [
          { key: 'coupons.read', label: 'عرض' },
          { key: 'coupons.write', label: 'إنشاء وتعديل' },
          { key: 'coupons.delete', label: 'حذف العروض' },
        ],
      },
      {
        id: 'reviews',
        label: 'التقييمات',
        icon: Star,
        actions: [
          { key: 'reviews.read', label: 'عرض' },
          { key: 'reviews.write', label: 'نشر وحذف' },
        ],
      },
      {
        id: 'customers',
        label: 'العملاء',
        icon: Users,
        actions: [{ key: 'customers.read', label: 'عرض والتواصل واتساب' }],
      },
    ],
  },
  {
    group: 'محتوى الموقع',
    hint: 'كل ما يظهر للعميلة',
    sections: [
      {
        id: 'homepage',
        label: 'الصفحة الرئيسية والسلايدر',
        icon: Home,
        actions: [
          { key: 'homepage.read', label: 'عرض' },
          { key: 'homepage.write', label: 'تعديل الشرائح والأقسام' },
        ],
      },
      {
        id: 'media',
        label: 'الوسائط',
        icon: ImageIcon,
        actions: [
          { key: 'media.read', label: 'عرض' },
          { key: 'media.write', label: 'رفع وحذف' },
        ],
      },
      {
        id: 'pages',
        label: 'الصفحات',
        icon: FileText,
        actions: [
          { key: 'pages.read', label: 'عرض' },
          { key: 'pages.write', label: 'إنشاء وتعديل' },
        ],
      },
      {
        id: 'sectionstexts',
        label: 'أقسام الموقع',
        icon: Heading1,
        actions: [
          { key: 'sections.read', label: 'عرض' },
          { key: 'sections.write', label: 'تعديل' },
        ],
      },
      {
        id: 'content',
        label: 'النصوص والفوتر',
        icon: Type,
        actions: [
          { key: 'content.read', label: 'عرض' },
          { key: 'content.write', label: 'تعديل' },
        ],
      },
      {
        id: 'theme',
        label: 'الثيم والألوان',
        icon: Palette,
        actions: [
          { key: 'theme.read', label: 'عرض' },
          { key: 'theme.write', label: 'تغيير الألوان' },
        ],
      },
    ],
  },
  {
    group: 'التقارير والسجلات',
    hint: 'متابعة الأداء والنشاط',
    sections: [
      {
        id: 'overview',
        label: 'نظرة عامة',
        icon: LayoutDashboard,
        actions: [{ key: 'dashboard.read', label: 'عرض' }],
      },
      {
        id: 'analytics',
        label: 'التحليلات',
        icon: BarChart3,
        actions: [{ key: 'analytics.read', label: 'عرض' }],
      },
      {
        id: 'visits',
        label: 'سجل الزيارات',
        icon: Activity,
        actions: [{ key: 'visits.read', label: 'عرض' }],
      },
      {
        id: 'audit',
        label: 'السجل',
        icon: ScrollText,
        actions: [{ key: 'audit.read', label: 'عرض' }],
      },
    ],
  },
  {
    group: 'أدوات ذكية وإدارة',
    hint: 'المساعد الذكي وإعدادات المتجر',
    sections: [
      {
        id: 'assistant',
        label: 'المساعد (لُو)',
        icon: Sparkles,
        actions: [
          { key: 'ai.use', label: 'استخدام' },
          { key: 'ai.execute', label: 'تنفيذ إجراءات' },
        ],
      },
      {
        id: 'settings',
        label: 'الإعدادات',
        icon: Settings,
        ownerOnly: true,
        note: 'مدير المتجر فقط — بيانات الشحن والدفع والواتساب',
        actions: [
          { key: 'settings.read', label: 'عرض' },
          { key: 'settings.write', label: 'تعديل' },
        ],
      },
      {
        id: 'users',
        label: 'الفريق والصلاحيات',
        icon: UserCog,
        ownerOnly: true,
        note: 'مدير المتجر فقط — إنشاء الأعضاء وتعديل صلاحياتهم',
        actions: [
          { key: 'users.read', label: 'عرض' },
          { key: 'users.write', label: 'إدارة' },
        ],
      },
    ],
  },
];

const ALL_ACTION_KEYS = PERM_SECTIONS.flatMap((g) => g.sections.flatMap((s) => s.actions.map((a) => a.key)));

/** role presets — one click fills the matrix */
const PRESETS: { id: string; label: string; keys: string[] }[] = [
  {
    id: 'viewer',
    label: 'مشاهدة فقط',
    keys: [
      'dashboard.read',
      'orders.read',
      'products.read',
      'categories.read',
      'coupons.read',
      'customers.read',
      'reviews.read',
      'homepage.read',
      'media.read',
      'pages.read',
      'sections.read',
      'content.read',
      'theme.read',
      'analytics.read',
      'visits.read',
    ],
  },
  {
    id: 'orders',
    label: 'متابعة الطلبات',
    keys: ['dashboard.read', 'orders.read', 'orders.write', 'products.read', 'customers.read', 'coupons.read', 'reviews.read', 'analytics.read'],
  },
  {
    id: 'content',
    label: 'محررة المحتوى',
    keys: [
      'dashboard.read',
      'products.read',
      'products.write',
      'categories.read',
      'categories.write',
      'homepage.read',
      'homepage.write',
      'media.read',
      'media.write',
      'pages.read',
      'pages.write',
      'sections.read',
      'sections.write',
      'content.read',
      'content.write',
      'theme.read',
      'theme.write',
      'ai.use',
    ],
  },
  {
    id: 'full',
    label: 'كل الصلاحيات',
    keys: ALL_ACTION_KEYS,
  },
];

const DEFAULT_PERMS = PRESETS.find((p) => p.id === 'orders')!.keys;

/* ── the shared matrix — used by «إضافة عضو» and «تعديل عضو» dialogs ── */

function PermMatrix({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="grid gap-4" role="group" aria-label="صلاحيات العضو">
      {PERM_SECTIONS.map((group) => {
        const groupKeys = group.sections.flatMap((s) => (s.ownerOnly ? [] : s.actions.map((a) => a.key)));
        const grantedInGroup = groupKeys.filter((k) => value.includes(k)).length;
        return (
          <fieldset key={group.group} className="rounded-2xl border border-border/60 bg-secondary/20 p-3">
            <legend className="flex items-center gap-2 px-2 text-xs font-black text-primary">
              {group.group}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                {grantedInGroup}/{groupKeys.length}
              </span>
            </legend>
            <span className="mb-2 block text-[10px] text-muted-foreground">{group.hint}</span>
            <div className="grid gap-2">
              {group.sections.map((section) => {
                const Icon = section.icon;
                const sectionKeys = section.actions.map((a) => a.key);
                const allOn = sectionKeys.every((k) => value.includes(k));
                const anyOn = sectionKeys.some((k) => value.includes(k));
                return (
                  <div
                    key={section.id}
                    className={cn(
                      'rounded-xl border bg-card px-3 py-2.5 transition-colors',
                      allOn ? 'border-primary/40' : anyOn ? 'border-primary/20' : 'border-border/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'grid h-7 w-7 shrink-0 place-items-center rounded-lg',
                          anyOn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-black">{section.label}</span>
                      {section.ownerOnly ? (
                        <span className="flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-1 text-[10px] font-bold text-muted-foreground">
                          <Lock className="h-3 w-3" /> {section.note?.split('—')[0]}
                        </span>
                      ) : (
                        sectionKeys.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              onChange(
                                allOn
                                  ? value.filter((k) => !sectionKeys.includes(k))
                                  : [...new Set([...value, ...sectionKeys])]
                              )
                            }
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-[10px] font-black transition-colors',
                              allOn
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-primary/30 text-primary hover:bg-secondary'
                            )}
                          >
                            {allOn ? 'إلغاء القسم' : 'الكل ✓'}
                          </button>
                        )
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {section.actions.map((action) => {
                        const on = value.includes(action.key);
                        return (
                          <button
                            key={action.key}
                            type="button"
                            disabled={section.ownerOnly}
                            aria-pressed={on}
                            onClick={() => toggle(action.key)}
                            className={cn(
                              'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors',
                              on
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary',
                              section.ownerOnly && 'cursor-not-allowed opacity-50'
                            )}
                          >
                            {on && <Check className="h-3 w-3" />}
                            {action.label}
                          </button>
                        );
                      })}
                    </div>
                    {section.ownerOnly && section.note && (
                      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{section.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function PresetRow({ onPick }: { onPick: (keys: string[]) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-black text-muted-foreground">أدوار جاهزة:</span>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.keys)}
          className="rounded-full border border-primary/30 bg-background px-2.5 py-1 text-[11px] font-black text-primary transition-colors hover:bg-secondary"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function PermSummary({ permissions }: { permissions?: string | null }) {
  let keys: string[] = [];
  try {
    const parsed = JSON.parse(permissions || '[]');
    if (Array.isArray(parsed)) keys = parsed.filter((k) => typeof k === 'string');
  } catch {
    keys = [];
  }
  const covered = PERM_SECTIONS.flatMap((g) => g.sections)
    .filter((s) => !s.ownerOnly && s.actions.some((a) => keys.includes(a.key)))
    .map((s) => s.label);
  if (!covered.length) return <span className="text-[11px] text-muted-foreground">لا صلاحيات محددة</span>;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {covered.slice(0, 4).map((label) => (
        <em key={label} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold not-italic text-primary">
          {label}
        </em>
      ))}
      {covered.length > 4 && (
        <em className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold not-italic text-muted-foreground">
          +{covered.length - 4}
        </em>
      )}
    </span>
  );
}

export default function UsersSection({ currentId }: { currentId?: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', verificationCode: '' });
  const [perms, setPerms] = useState<string[]>(DEFAULT_PERMS);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { ok, data } = await apiJson<{ ok: boolean; users: AdminUser[] }>('/api/admin/users');
    if (ok && data?.ok) setUsers(data.users);
    else setUsers([]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save() {
    setSaving(true);
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ ...form, permissions: perms }),
    });
    setSaving(false);
    if (!ok || !data?.ok) {
      toast({ title: 'تعذر إنشاء المستخدم', description: data?.error, variant: 'destructive' });
      return;
    }
    toast({ title: `تم إنشاء حساب ${form.username} ✓` });
    setOpen(false);
    setForm({ username: '', displayName: '', password: '', verificationCode: '' });
    setPerms(DEFAULT_PERMS);
    load();
  }

  async function toggleActive(u: AdminUser) {
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !u.active }),
    });
    if (!ok || !data?.ok) {
      toast({ title: data?.error || 'تعذر التحديث', variant: 'destructive' });
      return;
    }
    toast({ title: u.active ? `تم تعطيل ${u.username}` : `تم تفعيل ${u.username}` });
    load();
  }

  // U19-PERMS — edit an existing member: permissions + optional password/code
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editPw, setEditPw] = useState('');
  const [editCode, setEditCode] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  function openEditUser(u: AdminUser) {
    setEditingUser(u);
    let current: string[] = [];
    try {
      const parsed = JSON.parse(u.permissions || '[]');
      if (Array.isArray(parsed)) current = parsed.filter((p) => typeof p === 'string');
    } catch {
      current = [];
    }
    setEditPerms(current);
    setEditPw('');
    setEditCode('');
  }

  async function saveEditUser() {
    if (!editingUser || savingUser) return;
    setSavingUser(true);
    const body: Record<string, unknown> = { permissions: editPerms };
    if (editPw.trim()) body.password = editPw.trim();
    if (editCode.trim()) body.verificationCode = editCode.trim();
    const { ok, data } = await apiJson<{ ok: boolean; error?: string }>(`/api/admin/users/${editingUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    setSavingUser(false);
    if (ok && data?.ok) {
      toast({ title: `تم تحديث صلاحيات ${editingUser.username} ✓` });
      setEditingUser(null);
      load();
    } else toast({ title: data?.error || 'تعذر التحديث', variant: 'destructive' });
  }

  if (!users)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button className="rounded-full gap-1.5 bg-primary font-bold text-primary-foreground" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> إضافة عضو فريق
        </Button>
        <span className="text-xs font-bold text-muted-foreground">{users.length} حساب</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {users.map((u) => (
          <div key={u.id} className={`rounded-2xl border border-border/60 bg-card p-4 shadow-sm ${!u.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${u.role === 'owner' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`}>
                {u.role === 'owner' ? <ShieldCheck className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <strong className="truncate">{u.displayName}</strong>
                  <em className={`rounded-full border px-2 py-0.5 text-[10px] font-bold not-italic ${u.role === 'owner' ? 'border-primary/30 bg-secondary text-primary' : 'border-border bg-secondary/50 text-muted-foreground'}`}>
                    {u.role === 'owner' ? 'Owner' : 'فريق'}
                  </em>
                </div>
                <span className="block text-xs text-muted-foreground" dir="ltr">@{u.username}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {u.lastLoginAt ? `آخر دخول: ${fmtDate(u.lastLoginAt)}` : 'لم يسجل دخول بعد'}
                </span>
                {/* U22-TEAM-PERMS — granted sections at a glance */}
                <PermSummary permissions={u.permissions} />
              </div>
              {u.role !== 'owner' && (
                <button
                  onClick={() => openEditUser(u)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                  aria-label={`تعديل صلاحيات ${u.username}`}
                  title="تعديل الصلاحيات وكلمة المرور"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {u.role !== 'owner' && (
                <button
                  onClick={() => toggleActive(u)}
                  role="switch"
                  aria-checked={u.active}
                  aria-label={`تبديل تفعيل ${u.username}`}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${u.active ? 'bg-emerald-500' : 'bg-stone-300'}`}
                >
                  <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ right: u.active ? '2px' : '22px' }} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">إضافة عضو فريق</DialogTitle>
            <p className="text-xs leading-relaxed text-muted-foreground">
              اختاري الصلاحيات لكل قسم من أقسام الأدمن — عرض فقط أو تعديل كامل، أو استخدمي دورًا جاهزًا.
            </p>
          </DialogHeader>
          <div className="grid gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="u-username">اسم المستخدم *</Label>
                <Input id="u-username" dir="ltr" className="text-left" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="sara" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="u-display">الاسم الظاهر</Label>
                <Input id="u-display" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="سارة" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="u-pass">كلمة المرور *</Label>
                <Input id="u-pass" dir="ltr" type="password" className="text-left" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8 أحرف+" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="u-code">كود التحقق *</Label>
                <Input id="u-code" dir="ltr" className="text-left" value={form.verificationCode} onChange={(e) => setForm({ ...form, verificationCode: e.target.value })} placeholder="كود سري" />
              </div>
            </div>
            <PresetRow onPick={(keys) => setPerms([...keys])} />
            <PermMatrix value={perms} onChange={setPerms} />
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] font-bold text-muted-foreground">
                {perms.length} صلاحية محددة
              </span>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}><X className="h-4 w-4" /> إلغاء</Button>
                <Button disabled={saving || !form.username.trim() || form.password.length < 8 || !form.verificationCode.trim()} onClick={save} className="rounded-full bg-primary font-bold text-primary-foreground">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إنشاء الحساب'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* U19-PERMS — تعديل عضو موجود: الصلاحيات + كلمة المرور + كود التحقق */}
      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">تعديل {editingUser?.displayName || editingUser?.username}</DialogTitle>
            <p className="text-xs leading-relaxed text-muted-foreground">حدّثي الصلاحيات لكل قسم، أو كلمة المرور وكود التحقق.</p>
          </DialogHeader>
          <div className="grid gap-3.5">
            <PresetRow onPick={(keys) => setEditPerms([...keys])} />
            <PermMatrix value={editPerms} onChange={setEditPerms} />
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ue-pass">كلمة مرور جديدة (اختياري)</Label>
                <Input id="ue-pass" dir="ltr" type="password" className="text-left" value={editPw} onChange={(e) => setEditPw(e.target.value)} placeholder="8 أحرف+" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ue-code">كود تحقق جديد (اختياري)</Label>
                <Input id="ue-code" dir="ltr" className="text-left" value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="اتركيه فارغًا للإبقاء" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] font-bold text-muted-foreground">{editPerms.length} صلاحية محددة</span>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setEditingUser(null)}><X className="h-4 w-4" /> إلغاء</Button>
                <Button disabled={savingUser} onClick={saveEditUser} className="rounded-full bg-primary font-bold text-primary-foreground">
                  {savingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ التعديلات'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
