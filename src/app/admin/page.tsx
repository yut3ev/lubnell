'use client';

import { useEffect, useState } from 'react';
import AdminLogin from '@/components/admin/admin-login';
import AdminDashboard from '@/components/admin/dashboard';
import { apiJson, type AdminInfo } from '@/components/admin/helpers';
import { Loader2 } from 'lucide-react';

export default function AdminPage() {
  const [state, setState] = useState<'loading' | 'anon' | 'authed'>('loading');
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [probe, setProbe] = useState(0);

  useEffect(() => {
    let alive = true;
    apiJson<{ ok: boolean; admin: AdminInfo }>('/api/admin/login').then(({ ok, data }) => {
      if (!alive) return;
      if (ok && data?.ok) {
        setAdmin(data.admin);
        setState('authed');
      } else {
        setState('anon');
      }
    });
    return () => {
      alive = false;
    };
  }, [probe]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
      </div>
    );
  }

  if (state === 'anon') {
    return <AdminLogin onDone={() => setProbe((p) => p + 1)} />;
  }

  return <AdminDashboard admin={admin!} onLogout={() => setProbe((p) => p + 1)} />;
}
