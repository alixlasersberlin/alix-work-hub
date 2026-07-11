import { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Row {
  id: string; entity_type: string; entity_id: string | null; action: string;
  user_id: string | null; old_data: any; new_data: any; created_at: string;
}

const ACTION_COLOR: Record<string, string> = {
  INSERT: 'bg-emerald-500/15 text-emerald-500',
  UPDATE: 'bg-amber-500/15 text-amber-500',
  DELETE: 'bg-red-500/15 text-red-500',
  EMAIL_SENT: 'bg-blue-500/15 text-blue-500',
  EMAIL_FAILED: 'bg-red-500/15 text-red-500',
  TOKEN_ISSUE: 'bg-purple-500/15 text-purple-500',
  TOKEN_VERIFY: 'bg-slate-500/15 text-slate-400',
};

export default function EscAuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('alle');
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    let query: any = (supabase as any).from('esc_audit_log').select('*')
      .order('created_at', { ascending: false }).limit(500);
    if (entity !== 'alle') query = query.eq('entity_type', entity);
    const { data } = await query;
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-line */ }, [entity]);

  const filtered = rows.filter(r => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold">ESC Audit-Log</h1>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Aktualisieren</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Filter</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px]"><Label>Bereich</Label>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['alle','esc_events','esc_event_participants','esc_event_resources','esc_public_bookings','esc_token','esc_ech_message'].map(x =>
                  <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[240px]"><Label>Suche</Label>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Volltext…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Einträge ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Zeitpunkt</th>
                <th className="p-3">Bereich</th>
                <th className="p-3">Aktion</th>
                <th className="p-3">Entity</th>
                <th className="p-3">User</th>
                <th className="p-3">Diff</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="p-6 text-center">Lädt…</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Einträge</td></tr>
                : filtered.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3 whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                    <td className="p-3 font-mono text-xs">{r.entity_type}</td>
                    <td className="p-3"><Badge variant="outline" className={ACTION_COLOR[r.action] || ''}>{r.action}</Badge></td>
                    <td className="p-3 font-mono text-xs">{r.entity_id?.slice(0, 8) || '—'}</td>
                    <td className="p-3 font-mono text-xs">{r.user_id?.slice(0, 8) || 'system'}</td>
                    <td className="p-3">
                      <details>
                        <summary className="cursor-pointer text-xs text-muted-foreground">anzeigen</summary>
                        <pre className="mt-2 max-w-2xl overflow-auto rounded bg-muted p-2 text-[10px]">
{JSON.stringify({ old: r.old_data, new: r.new_data }, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
