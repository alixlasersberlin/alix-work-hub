import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Shield, Check, Minus, X } from 'lucide-react';
import { CRITICAL_ROLE_NAMES } from './lib';

type SecRole = { id: string; key: string; name: string; hierarchy_level: number; is_active: boolean };
type SecPerm = { id: string; key: string; module: string; action: string; description: string | null; risk_level: string };
type SecRp = { role_id: string; permission_id: string; allowed: boolean };

export default function Matrix() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<SecRole[]>([]);
  const [perms, setPerms] = useState<SecPerm[]>([]);
  const [rp, setRp] = useState<SecRp[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const [r, p, rpx] = await Promise.all([
        supabase.from('security_roles').select('id, key, name, hierarchy_level, is_active').eq('is_active', true).order('hierarchy_level'),
        supabase.from('security_permissions').select('id, key, module, action, description, risk_level').eq('is_active', true).order('module'),
        supabase.from('security_role_permissions').select('role_id, permission_id, allowed'),
      ]);
      setRoles((r.data ?? []) as SecRole[]);
      setPerms((p.data ?? []) as SecPerm[]);
      setRp((rpx.data ?? []) as SecRp[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader compact />;

  const filtered = q
    ? perms.filter(p => `${p.module} ${p.action} ${p.key} ${p.description ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    : perms;

  // Gruppiere Berechtigungen nach Modul
  const byModule = filtered.reduce((acc, p) => {
    (acc[p.module] ||= []).push(p);
    return acc;
  }, {} as Record<string, SecPerm[]>);

  const has = (roleId: string, permId: string) => rp.find(x => x.role_id === roleId && x.permission_id === permId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Berechtigung suchen (Modul, Aktion, Beschreibung)…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="max-w-md"
        />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> erlaubt</span>
          <span className="flex items-center gap-1"><X className="w-3 h-3 text-red-500" /> ausdrücklich verboten</span>
          <span className="flex items-center gap-1"><Minus className="w-3 h-3 opacity-40" /> nicht gesetzt</span>
          <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-amber-500" /> kritisches Recht</span>
        </div>
      </div>

      {roles.length === 0 || perms.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Kein <code>security_permissions</code>/<code>security_roles</code>-Katalog gefunden. Die Rollen-Matrix nutzt diese Tabellen als Berechtigungskatalog.
        </Card>
      ) : (
        <Card className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="border-b">
                <th className="text-left p-2 font-medium min-w-[240px] sticky left-0 bg-card/95 z-20">Berechtigung</th>
                {roles.map(r => (
                  <th key={r.id} className="p-2 font-medium text-center min-w-[80px]">
                    <div className="rotate-[-40deg] origin-bottom-left inline-block whitespace-nowrap pl-6 pt-4">
                      <span className={CRITICAL_ROLE_NAMES.has(r.name) ? 'text-amber-500' : ''}>{r.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byModule).map(([mod, items]) => (
                <>
                  <tr key={`m-${mod}`} className="bg-muted/40">
                    <td colSpan={roles.length + 1} className="p-2 font-semibold text-primary uppercase text-[11px] tracking-wider">
                      {mod}
                    </td>
                  </tr>
                  {items.map(p => (
                    <tr key={p.id} className="border-b hover:bg-muted/20">
                      <td className="p-2 sticky left-0 bg-card/95 z-10">
                        <div className="flex items-center gap-1">
                          <span>{p.action}</span>
                          {['high','critical'].includes(p.risk_level) && <Shield className="w-3 h-3 text-amber-500" />}
                          <span className="text-muted-foreground/60">— {p.key}</span>
                        </div>
                        {p.description && <div className="text-muted-foreground text-[10px] mt-0.5">{p.description}</div>}
                      </td>
                      {roles.map(r => {
                        const cell = has(r.id, p.id);
                        return (
                          <td key={r.id} className="p-2 text-center">
                            {cell?.allowed === true && <Check className="w-4 h-4 text-emerald-500 inline" />}
                            {cell?.allowed === false && <X className="w-4 h-4 text-red-500 inline" />}
                            {!cell && <Minus className="w-4 h-4 opacity-30 inline" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Matrix ist read-only. Bearbeitung erfolgt aus Sicherheitsgründen ausschließlich über <b>Freigabeanträge</b>.
      </p>
    </div>
  );
}

function Loader({ compact }: { compact?: boolean }) {
  return <div className={`flex items-center gap-2 text-muted-foreground ${compact ? 'p-4' : 'p-8'}`}><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;
}
