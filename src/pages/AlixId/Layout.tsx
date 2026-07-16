import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, LayoutGrid, User2, ShieldCheck, ScrollText, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type AlixIdCtx = {
  authUserId: string;
  email: string | null;
  identityId: string | null;
  displayName: string | null;
};

export function useAlixIdSession() {
  const [ctx, setCtx] = useState<AlixIdCtx | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) { setLoading(false); return; }
      const { data: identity } = await supabase
        .from('alix_identities')
        .select('id, display_name, account_status')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!alive) return;
      if (identity && identity.account_status !== 'active') {
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      setCtx({
        authUserId: user.id,
        email: user.email ?? null,
        identityId: identity?.id ?? null,
        displayName: identity?.display_name ?? user.email ?? null,
      });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return { ctx, loading };
}

const tabs = [
  { to: '/id/apps', label: 'Meine Apps', icon: LayoutGrid },
  { to: '/id/konto', label: 'Konto', icon: User2 },
  { to: '/id/sicherheit', label: 'Sicherheit', icon: ShieldCheck },
  { to: '/id/sitzungen', label: 'Aktivitäten', icon: ScrollText },
];

export default function AlixIdLayout() {
  const { ctx, loading } = useAlixIdSession();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!ctx) {
    navigate('/id/login', { replace: true });
    return null;
  }

  const logout = async () => {
    try {
      await supabase.functions.invoke('alix-id-logout', { body: { scope: 'global' } });
    } catch { /* ignore */ }
    await supabase.auth.signOut();
    toast.success('Abgemeldet.');
    navigate('/id/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold leading-none">Alix ID</div>
              <div className="text-xs text-muted-foreground">{ctx.email}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Abmelden
          </Button>
        </div>
        <nav className="max-w-6xl mx-auto flex gap-1 px-4 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 text-sm border-b-2 whitespace-nowrap',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="w-4 h-4" /> {t.label}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto p-4 md:p-6">
        <Outlet context={ctx} />
      </main>
    </div>
  );
}
