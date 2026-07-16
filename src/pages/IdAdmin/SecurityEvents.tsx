import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCcw } from 'lucide-react';

type Ev = {
  id: string; identity_id: string | null; application_id: string | null;
  event_type: string; severity: string; success: boolean; created_at: string;
  ip_address: string | null; metadata: any;
};

const sevColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  info: 'secondary', warn: 'outline', error: 'destructive', critical: 'destructive',
};

export default function IdAdminSecurityEvents() {
  const [rows, setRows] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('alix_security_events')
      .select('id, identity_id, application_id, event_type, severity, success, created_at, ip_address, metadata')
      .order('created_at', { ascending: false }).limit(300);
    if (filter.trim()) q = q.ilike('event_type', `%${filter.trim()}%`);
    const { data } = await q;
    setRows((data ?? []) as Ev[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Sicherheits-Ereignisse</CardTitle>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="event_type filtern…" className="h-9 w-64" />
          <Button type="submit" size="sm" variant="outline"><RefreshCcw className="w-3 h-3 mr-1" /> Aktualisieren</Button>
        </form>
      </CardHeader>
      <CardContent>
        {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2 pr-4">Zeit</th><th className="py-2 pr-4">Event</th><th className="py-2 pr-4">Severity</th><th className="py-2 pr-4">Erfolg</th><th className="py-2 pr-4">Identität</th><th className="py-2 pr-4">App</th><th className="py-2 pr-4">IP</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.event_type}</td>
                    <td className="py-2 pr-4"><Badge variant={sevColor[r.severity] ?? 'secondary'}>{r.severity}</Badge></td>
                    <td className="py-2 pr-4">{r.success ? '✓' : '✗'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.identity_id?.slice(0, 8) ?? '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.application_id?.slice(0, 8) ?? '—'}</td>
                    <td className="py-2 pr-4 text-xs">{r.ip_address ?? '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Keine Ereignisse.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
