import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface User { id: string; full_name: string | null; email: string | null }
interface Perm { id: string; key: string; module: string; risk_level: string }

/**
 * Zugriffs-Simulation (READ-ONLY): zeigt, welche security_permissions einem
 * bestimmten User über security_user_roles/role_permissions zugewiesen sind.
 * Ändert nichts.
 */
export default function SecuritySimulate() {
  const [users, setUsers] = useState<User[]>([]);
  const [uid, setUid] = useState<string>('');
  const [perms, setPerms] = useState<Perm[]>([]);
  const [granted, setGranted] = useState<string[]>([]);
  const [roles, setRoles] = useState<{ key: string; name: string }[]>([]);

  useEffect(() => { (async () => {
    const [{ data: u }, { data: p }] = await Promise.all([
      (supabase as any).from('user_profiles').select('id, full_name, email').eq('is_active', true).order('full_name'),
      (supabase as any).from('security_permissions').select('id, key, module, risk_level').order('module').order('key'),
    ]);
    setUsers((u ?? []) as User[]);
    setPerms((p ?? []) as Perm[]);
  })(); }, []);

  useEffect(() => { (async () => {
    if (!uid) { setGranted([]); setRoles([]); return; }
    const { data: ur } = await (supabase as any)
      .from('security_user_roles')
      .select('role_id, is_active, security_roles(key, name)')
      .eq('user_id', uid);
    setRoles(((ur ?? []) as any[]).filter(x => x.is_active && x.security_roles).map(x => x.security_roles));

    const { data: rp } = await (supabase as any)
      .from('security_role_permissions')
      .select('allowed, permission_id, security_permissions(key), role_id')
      .in('role_id', ((ur ?? []) as any[]).map(x => x.role_id));
    const keys = new Set<string>();
    ((rp ?? []) as any[]).forEach(r => { if (r.allowed && r.security_permissions?.key) keys.add(r.security_permissions.key); });
    setGranted(Array.from(keys));
  })(); }, [uid]);

  const byModule = useMemo(() => {
    const g: Record<string, { key: string; allowed: boolean; risk: string }[]> = {};
    perms.forEach(p => { (g[p.module] ||= []).push({ key: p.key, allowed: granted.includes(p.key), risk: p.risk_level }); });
    return g;
  }, [perms, granted]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Zugriffs-Simulation (nur lesend)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Zeigt, welche Berechtigungen aus dem <em>neuen</em> Security-Core einem Benutzer aktuell zugeordnet wären.
            Solange <code>security_user_roles</code> leer ist, sind hier noch keine Rechte gesetzt — bestehende Rollen aus <code>user_roles</code> gelten davon unabhängig weiter.
          </p>
          <div className="max-w-md">
            <Select value={uid} onValueChange={setUid}>
              <SelectTrigger><SelectValue placeholder="Benutzer wählen…" /></SelectTrigger>
              <SelectContent>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email || u.id.slice(0, 8)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {uid && (
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Zugewiesene Security-Rollen:</div>
              <div className="flex flex-wrap gap-1">
                {roles.length
                  ? roles.map(r => <Badge key={r.key} variant="outline">{r.name}</Badge>)
                  : <span className="text-xs text-muted-foreground">— keine —</span>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {uid && (
        <Card>
          <CardHeader><CardTitle className="text-base">Berechtigungen ({granted.length} / {perms.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(byModule).map(([mod, list]) => (
                <div key={mod}>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{mod}</div>
                  <div className="flex flex-wrap gap-1">
                    {list.map(p => (
                      <span key={p.key} className={`text-[11px] font-mono px-2 py-0.5 rounded border ${p.allowed ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-muted/30 border-border text-muted-foreground line-through'}`}>
                        {p.key}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
