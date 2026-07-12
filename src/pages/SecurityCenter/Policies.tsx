import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Pol { schema_name: string; table_name: string; policy_name: string; cmd: string; using_expr: string | null; check_expr: string | null; roles: string | null }

function riskOf(p: Pol): string | null {
  const u = (p.using_expr ?? '').trim();
  const c = (p.check_expr ?? '').trim();
  if ((u === 'true' || u === '(true)') && (p.roles ?? '').includes('anon')) return 'critical';
  if ((u === 'true' || u === '(true)') && p.cmd !== 'SELECT') return 'high';
  if (u === 'true' || u === '(true)') return 'medium';
  if ((c === 'true' || c === '(true)') && p.cmd !== 'SELECT') return 'high';
  return null;
}

const RISK: Record<string, string> = {
  medium: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  high: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/10 text-red-300 border-red-500/30',
};

export default function SecurityPolicies() {
  const [rows, setRows] = useState<Pol[]>([]);
  const [q, setQ] = useState('');
  const [onlyRisky, setOnlyRisky] = useState(true);

  useEffect(() => { (async () => {
    const { data } = await (supabase as any).from('security_policy_details').select('*').order('table_name');
    setRows((data ?? []) as Pol[]);
  })(); }, []);

  const filtered = rows.filter(r => {
    if (q && !r.table_name.toLowerCase().includes(q.toLowerCase()) && !r.policy_name.toLowerCase().includes(q.toLowerCase())) return false;
    if (onlyRisky && !riskOf(r)) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">RLS-Policies — {rows.length} gesamt, {filtered.length} angezeigt</CardTitle></CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-3">
          <Input placeholder="Filter…" value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={onlyRisky} onChange={e => setOnlyRisky(e.target.checked)} />
            Nur potenziell riskante anzeigen
          </label>
        </div>
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-left"><tr>
              <th className="p-2">Tabelle</th>
              <th className="p-2">Policy</th>
              <th className="p-2">Cmd</th>
              <th className="p-2">Rollen</th>
              <th className="p-2">USING</th>
              <th className="p-2">CHECK</th>
              <th className="p-2">Risiko</th>
            </tr></thead>
            <tbody>
              {filtered.map((r, i) => {
                const risk = riskOf(r);
                return (
                  <tr key={i} className="border-t hover:bg-muted/20 align-top">
                    <td className="p-2 font-mono">{r.table_name}</td>
                    <td className="p-2">{r.policy_name}</td>
                    <td className="p-2">{r.cmd}</td>
                    <td className="p-2 text-muted-foreground">{r.roles}</td>
                    <td className="p-2 font-mono text-[11px] max-w-[240px] truncate" title={r.using_expr ?? ''}>{r.using_expr ?? '—'}</td>
                    <td className="p-2 font-mono text-[11px] max-w-[240px] truncate" title={r.check_expr ?? ''}>{r.check_expr ?? '—'}</td>
                    <td className="p-2">{risk && <Badge variant="outline" className={RISK[risk]}>{risk}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
