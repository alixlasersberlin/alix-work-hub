import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Shield } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*, departments(name)')
        .order('created_at', { ascending: false });

      if (profiles) {
        const enriched = await Promise.all(
          profiles.map(async (p) => {
            const { data: userRoles } = await supabase
              .from('user_roles')
              .select('roles(name)')
              .eq('user_id', p.id);
            return {
              ...p,
              roleNames: userRoles?.map((r: any) => r.roles?.name).filter(Boolean) ?? [],
            };
          })
        );
        setUsers(enriched);
      }
      setLoading(false);
    }
    load();
  }, []);

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-success/10 text-success';
    if (s === 'suspended') return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Benutzerverwaltung
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{users.length} Benutzer</p>
      </div>

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Name</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">E-Mail</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Abteilung</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Rollen</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Einladung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Laden...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Keine Benutzer gefunden.</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.departments?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roleNames.length > 0 ? u.roleNames.map((r: string) => (
                          <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            <Shield className="w-3 h-3" />{r}
                          </span>
                        )) : <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(u.account_status)}`}>
                        {u.account_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{u.invitation_status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
