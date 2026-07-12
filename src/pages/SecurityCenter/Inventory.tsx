import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Row {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
  select_policies: number;
  insert_policies: number;
  update_policies: number;
  delete_policies: number;
  anon_access: boolean;
  has_tenant_id: boolean;
  has_department_id: boolean;
  has_user_id: boolean;
  has_customer_id: boolean;
  classification: number | null;
  classification_category: string | null;
}

const CLASS_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: 'Öffentlich', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  2: { label: 'Intern', cls: 'bg-blue-500/10 text-blue-300 border-blue-500/30' },
  3: { label: 'Vertraulich', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  4: { label: 'Hochsensibel', cls: 'bg-red-500/10 text-red-300 border-red-500/30' },
};

function risk(r: Row): { level: string; cls: string } {
  if (!r.rls_enabled) return { level: 'Kritisch', cls: 'bg-red-500/15 text-red-300 border-red-500/40' };
  if (r.rls_enabled && r.policy_count === 0) return { level: 'Kritisch', cls: 'bg-red-500/15 text-red-300 border-red-500/40' };
  if (r.anon_access && (r.classification ?? 0) >= 3) return { level: 'Hoch', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40' };
  if (r.classification === 4 && r.delete_policies > 1) return { level: 'Mittel', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' };
  if (r.classification === null) return { level: 'Nicht klassifiziert', cls: 'bg-muted text-muted-foreground border-border' };
  return { level: 'Geprüft', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
}

export default function SecurityInventory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('security_table_inventory').select('*').order('table_name');
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => !q || r.table_name.toLowerCase().includes(q.toLowerCase()) || (r.classification_category ?? '').toLowerCase().includes(q.toLowerCase()));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sicherheitsprüfung — {rows.length} Tabellen</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Filter: Tabellenname oder Kategorie…" value={q} onChange={e => setQ(e.target.value)} className="mb-3 max-w-md" />
        {loading ? <div className="text-sm text-muted-foreground">Wird geladen…</div> : (
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2">Tabelle</th>
                  <th className="p-2">Klasse</th>
                  <th className="p-2 text-center">RLS</th>
                  <th className="p-2 text-center">SEL</th>
                  <th className="p-2 text-center">INS</th>
                  <th className="p-2 text-center">UPD</th>
                  <th className="p-2 text-center">DEL</th>
                  <th className="p-2 text-center">anon</th>
                  <th className="p-2 text-center">Mandant</th>
                  <th className="p-2 text-center">Abteilung</th>
                  <th className="p-2 text-center">Owner</th>
                  <th className="p-2">Risiko</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const rk = risk(r);
                  const cls = r.classification ? CLASS_LABEL[r.classification] : null;
                  return (
                    <tr key={r.table_name} className="border-t hover:bg-muted/20">
                      <td className="p-2 font-mono">{r.table_name}</td>
                      <td className="p-2">{cls && <Badge variant="outline" className={cls.cls}>{cls.label}</Badge>}</td>
                      <td className="p-2 text-center">{r.rls_enabled ? '✅' : '❌'}</td>
                      <td className="p-2 text-center">{r.select_policies || '—'}</td>
                      <td className="p-2 text-center">{r.insert_policies || '—'}</td>
                      <td className="p-2 text-center">{r.update_policies || '—'}</td>
                      <td className="p-2 text-center">{r.delete_policies || '—'}</td>
                      <td className="p-2 text-center">{r.anon_access ? '⚠️' : '—'}</td>
                      <td className="p-2 text-center">{r.has_tenant_id ? '✓' : '—'}</td>
                      <td className="p-2 text-center">{r.has_department_id ? '✓' : '—'}</td>
                      <td className="p-2 text-center">{r.has_user_id || r.has_customer_id ? '✓' : '—'}</td>
                      <td className="p-2"><Badge variant="outline" className={rk.cls}>{rk.level}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
