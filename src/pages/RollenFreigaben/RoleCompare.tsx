import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, GitCompare, Check, X, Shield } from 'lucide-react';
import { CRITICAL_ROLE_NAMES } from './lib';

export default function RoleCompare() {
  const [roles, setRoles] = useState<any[]>([]);
  const [perms, setPerms] = useState<any[]>([]);
  const [rp, setRp] = useState<any[]>([]);
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, p, rpx] = await Promise.all([
        supabase.from('security_roles').select('id, name, hierarchy_level').eq('is_active', true).order('hierarchy_level'),
        supabase.from('security_permissions').select('id, key, module, action, risk_level').eq('is_active', true).order('module'),
        supabase.from('security_role_permissions').select('role_id, permission_id, allowed'),
      ]);
      setRoles(r.data ?? []); setPerms(p.data ?? []); setRp(rpx.data ?? []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    if (!a || !b) return [];
    return perms.map(p => {
      const ra = rp.find(x => x.role_id === a && x.permission_id === p.id);
      const rb = rp.find(x => x.role_id === b && x.permission_id === p.id);
      return {
        ...p,
        a: ra?.allowed === true, b: rb?.allowed === true,
        diff: (ra?.allowed === true) !== (rb?.allowed === true),
      };
    });
  }, [a, b, perms, rp]);

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade Katalog…</div>;

  const roleA = roles.find(r => r.id === a);
  const roleB = roles.find(r => r.id === b);
  const diffCount = rows.filter(r => r.diff).length;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitCompare className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Rollen-Vergleich</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select value={a} onValueChange={setA}>
            <SelectTrigger><SelectValue placeholder="Rolle A wählen…" /></SelectTrigger>
            <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={b} onValueChange={setB}>
            <SelectTrigger><SelectValue placeholder="Rolle B wählen…" /></SelectTrigger>
            <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </Card>

      {a && b && (
        <>
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="outline">{roleA?.name} vs. {roleB?.name}</Badge>
            <Badge variant="outline" className={diffCount > 0 ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'}>
              {diffCount} Unterschiede
            </Badge>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-2 font-medium">Berechtigung</th>
                  <th className="p-2 font-medium w-24 text-center">{roleA?.name}</th>
                  <th className="p-2 font-medium w-24 text-center">{roleB?.name}</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter(r => r.diff).map(r => (
                  <tr key={r.id} className="border-t bg-amber-500/5">
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{r.module}</span>
                        <span className="text-muted-foreground">/ {r.action}</span>
                        {['high','critical'].includes(r.risk_level) && <Shield className="w-3 h-3 text-amber-500" />}
                      </div>
                    </td>
                    <Cell v={r.a} />
                    <Cell v={r.b} />
                  </tr>
                ))}
                {diffCount === 0 && (
                  <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Beide Rollen haben identische Rechte im Katalog.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Cell({ v }: { v: boolean }) {
  return (
    <td className="p-2 text-center">
      {v ? <Check className="w-4 h-4 text-emerald-500 inline" /> : <X className="w-4 h-4 text-muted-foreground/50 inline" />}
    </td>
  );
}
