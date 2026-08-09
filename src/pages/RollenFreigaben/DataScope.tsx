import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface TenantRow { id: string; code: string; name: string; flag_emoji: string | null }
interface UserRow { id: string; full_name: string | null; email: string | null; is_active: boolean | null }

export default function DataScope() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [access, setAccess] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: u }, { data: a }] = await Promise.all([
        supabase.from('tenants').select('id,code,name,flag_emoji').eq('is_active', true).order('sort_order'),
        supabase.from('user_profiles').select('id,full_name,email,is_active').order('full_name'),
        supabase.from('user_tenant_access').select('user_id,tenant_id'),
      ]);
      setTenants((t as any) || []);
      setUsers((u as any) || []);
      const map: Record<string, Set<string>> = {};
      ((a as any) || []).forEach((r: any) => {
        (map[r.user_id] ||= new Set()).add(r.tenant_id);
      });
      setAccess(map);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s));
  }, [users, q]);

  const toggle = async (userId: string, tenantId: string, checked: boolean) => {
    setSaving(`${userId}:${tenantId}`);
    const next = { ...access, [userId]: new Set(access[userId] || []) };
    if (checked) next[userId].add(tenantId); else next[userId].delete(tenantId);
    setAccess(next);

    const { error } = checked
      ? await supabase.from('user_tenant_access').insert({ user_id: userId, tenant_id: tenantId })
      : await supabase.from('user_tenant_access').delete().eq('user_id', userId).eq('tenant_id', tenantId);

    setSaving(null);
    if (error) {
      toast.error(`Speichern fehlgeschlagen: ${error.message}`);
      const revert = { ...next, [userId]: new Set(next[userId]) };
      if (checked) revert[userId].delete(tenantId); else revert[userId].add(tenantId);
      setAccess(revert);
    } else {
      toast.success('Datenbereich aktualisiert');
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="w-4 h-4 animate-spin" /> Lade …</div>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h2 className="font-semibold">Datenbereich (Mandantenzugriff)</h2>
            <p className="text-sm text-muted-foreground">
              Rollen steuern <strong>was</strong> ein Benutzer darf, der Datenbereich steuert <strong>welche Daten</strong> er sieht.
              Ohne Häkchen sieht ein Benutzer alle Mandanten. Admins und Super Admins sehen immer alles.
              Die Einschränkung wird serverseitig per RLS erzwungen.
            </p>
          </div>
        </div>
      </Card>

      <Input placeholder="Benutzer suchen …" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium">Benutzer</th>
              {tenants.map(t => (
                <th key={t.id} className="p-3 font-medium text-center whitespace-nowrap">
                  <span className="mr-1">{t.flag_emoji || '🏢'}</span>{t.code}
                </th>
              ))}
              <th className="p-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => {
              const set = access[u.id] || new Set<string>();
              return (
                <tr key={u.id} className={i % 2 ? 'bg-muted/10' : ''}>
                  <td className="p-3">
                    <div className="font-medium">{u.full_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  {tenants.map(t => (
                    <td key={t.id} className="p-3 text-center">
                      <Checkbox
                        checked={set.has(t.id)}
                        disabled={saving === `${u.id}:${t.id}`}
                        onCheckedChange={(v) => toggle(u.id, t.id, v === true)}
                        aria-label={`${u.full_name} – ${t.name}`}
                      />
                    </td>
                  ))}
                  <td className="p-3 text-right">
                    {set.size === 0
                      ? <Badge variant="outline">Alle Mandanten</Badge>
                      : <Badge className="bg-primary/15 text-primary border-primary/30">{set.size} Mandant{set.size > 1 ? 'en' : ''}</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
