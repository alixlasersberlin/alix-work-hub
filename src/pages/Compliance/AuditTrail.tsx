import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useComplianceProfile } from '@/hooks/useComplianceProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Row {
  id: string; user_id: string | null; project_id: string | null; task_id: string | null;
  action: string; detail: any; created_at: string;
}

export default function ComplianceAuditTrail() {
  const c = useComplianceProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('compliance_audit_log').select('*').order('created_at', { ascending: false }).limit(500);
      setRows((data as Row[]) || []);
      const { data: u } = await (supabase as any).from('user_profiles').select('id, full_name, email');
      const map: Record<string, string> = {};
      (u || []).forEach((x: any) => { map[x.id] = x.full_name || x.email || x.id; });
      setNames(map);
      setLoading(false);
    })();
  }, []);

  if (!c.isComplianceAdmin) return <div className="text-sm text-muted-foreground">Kein Zugriff auf den Audit Trail.</div>;

  const filtered = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-semibold">Audit Trail</h1>
      <Card><CardContent className="pt-6"><Input className="max-w-sm" placeholder="Volltext…" value={q} onChange={(e) => setQ(e.target.value)} /></CardContent></Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Einträge ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {loading && <div className="py-6 text-center text-sm text-muted-foreground">Lädt…</div>}
          {!loading && filtered.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Keine Einträge.</div>}
          {filtered.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-[12px]">
              <span className="tabular-nums text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</span>
              <Badge variant="outline">{r.action}</Badge>
              <span>{names[r.user_id || ''] || 'system'}</span>
              {r.detail && <span className="font-mono text-[10px] text-muted-foreground truncate">{JSON.stringify(r.detail)}</span>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
