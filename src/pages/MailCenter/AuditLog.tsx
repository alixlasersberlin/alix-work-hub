import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Row { id: string; user_id: string | null; action: string; entity_type: string; entity_id: string | null; created_at: string; new_data: any; old_data: any; }

const ACTION_COLOR: Record<string, string> = {
  INSERT: 'bg-emerald-500/15 text-emerald-500',
  UPDATE: 'bg-amber-500/15 text-amber-500',
  DELETE: 'bg-red-500/15 text-red-500',
};

export default function AuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('mail_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    setRows((data as any) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r =>
    !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /><h2 className="text-xl font-semibold">Audit-Log</h2></div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Suchen…" className="pl-8 w-64" />
          </div>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Aktualisieren</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Zeit</th>
                <th className="p-3">Aktion</th>
                <th className="p-3">Bereich</th>
                <th className="p-3">Datensatz</th>
                <th className="p-3">Benutzer</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                  <td className="p-3"><Badge variant="outline" className={ACTION_COLOR[r.action] || ''}>{r.action}</Badge></td>
                  <td className="p-3">{r.entity_type}</td>
                  <td className="p-3 font-mono text-xs">{r.entity_id?.slice(0, 8) || '—'}</td>
                  <td className="p-3 font-mono text-xs">{r.user_id?.slice(0, 8) || 'system'}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Keine Einträge</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
