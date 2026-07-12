import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface Perm { id: string; key: string; module: string; action: string; description: string; risk_level: string }

const RISK: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  medium: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  high: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  critical: 'bg-red-500/10 text-red-300 border-red-500/30',
};

export default function SecurityPermissions() {
  const [perms, setPerms] = useState<Perm[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => { (async () => {
    const { data } = await (supabase as any).from('security_permissions').select('*').order('module').order('action');
    setPerms((data ?? []) as Perm[]);
  })(); }, []);

  const grouped = useMemo(() => {
    const g: Record<string, Perm[]> = {};
    perms.filter(p => !q || p.key.includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase()))
      .forEach(p => { (g[p.module] ||= []).push(p); });
    return g;
  }, [perms, q]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Berechtigungsmatrix — {perms.length} Rechte</CardTitle></CardHeader>
      <CardContent>
        <Input placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)} className="mb-3 max-w-md" />
        <div className="space-y-4">
          {Object.entries(grouped).map(([module, list]) => (
            <div key={module}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">{module}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {list.map(p => (
                  <div key={p.id} className="flex items-start gap-3 rounded border px-3 py-2">
                    <Badge variant="outline" className={RISK[p.risk_level] ?? ''}>{p.risk_level}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono">{p.key}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
