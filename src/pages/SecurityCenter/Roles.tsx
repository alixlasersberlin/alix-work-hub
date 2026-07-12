import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Role { id: string; key: string; name: string; description: string | null; hierarchy_level: number; is_active: boolean }

export default function SecurityRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [existing, setExisting] = useState<{ name: string; users: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: legacy }] = await Promise.all([
        (supabase as any).from('security_roles').select('*').order('hierarchy_level', { ascending: false }),
        (supabase as any).from('roles').select('name'),
      ]);
      setRoles((r ?? []) as Role[]);
      // Count users per legacy role
      const { data: ur } = await (supabase as any).from('user_roles').select('role_id');
      const counts: Record<string, number> = {};
      const legacyMap: Record<string, string> = {};
      (legacy ?? []).forEach((x: any) => { legacyMap[x.id] = x.name; });
      (ur ?? []).forEach((x: any) => { counts[x.role_id] = (counts[x.role_id] || 0) + 1; });
      const agg: Record<string, number> = {};
      Object.entries(counts).forEach(([id, n]) => { const name = legacyMap[id]; if (name) agg[name] = (agg[name] || 0) + n; });
      (legacy ?? []).forEach((x: any) => { if (!(x.name in agg)) agg[x.name] = 0; });
      setExisting(Object.entries(agg).map(([name, users]) => ({ name, users })).sort((a, b) => b.users - a.users));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Bestehende Rollen (produktiv)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Diese Rollen bleiben unverändert. Neue Systemrollen sind zusätzlich verfügbar.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {existing.map(r => (
              <div key={r.name} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span>{r.name}</span>
                <Badge variant="secondary">{r.users} User</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Neue Zielrollen (Security Core)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Vorschlag für ein konsistentes Rollenmodell. Noch keinem Benutzer zugeordnet.</p>
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/40 text-left"><tr>
                <th className="p-2">Level</th>
                <th className="p-2">Key (technisch)</th>
                <th className="p-2">Bezeichnung</th>
                <th className="p-2">Beschreibung</th>
              </tr></thead>
              <tbody>
                {roles.map(r => (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 font-mono">{r.hierarchy_level}</td>
                    <td className="p-2 font-mono">{r.key}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-muted-foreground">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
