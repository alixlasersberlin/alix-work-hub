import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Finding { id: string; category: string; target: string; severity: string; title: string; detail: string; recommendation: string; status: string; created_at: string; age_days?: number }

const SEV: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/40',
  high: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  low: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  info: 'bg-muted text-muted-foreground border-border',
};

export default function SecurityFindings() {
  const [rows, setRows] = useState<Finding[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [scanning, setScanning] = useState(false);
  const load = async () => {
    const { data } = await (supabase as any).from('security_findings_overview').select('*').order('severity').order('created_at', { ascending: false });
    setRows((data ?? []) as Finding[]);
  };
  useEffect(() => { load(); }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-auto-scan');
      if (error) throw error;
      toast.success(`Scan ok – ${(data as any)?.count ?? 0} potentielle Findings`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? 'Scan fehlgeschlagen');
    } finally {
      setScanning(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from('security_audit_findings').update({ status }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Status aktualisiert');
    load();
  };

  const visible = rows.filter(r => filter === 'all' || (filter === 'open' ? r.status !== 'resolved' : r.status === 'resolved'));
  const counts = {
    open: rows.filter(r => r.status !== 'resolved').length,
    resolved: rows.filter(r => r.status === 'resolved').length,
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Auto-Review — {visible.length} / {rows.length}</CardTitle>
        <div className="flex gap-1">
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>Alle ({rows.length})</Button>
          <Button size="sm" variant={filter === 'open' ? 'default' : 'outline'} onClick={() => setFilter('open')}>Offen ({counts.open})</Button>
          <Button size="sm" variant={filter === 'resolved' ? 'default' : 'outline'} onClick={() => setFilter('resolved')}>Behoben ({counts.resolved})</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visible.map(f => (
            <div key={f.id} className="rounded-md border p-3 text-sm space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={SEV[f.severity]}>{f.severity}</Badge>
                <Badge variant="secondary">{f.category}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{f.target}</span>
                {typeof f.age_days === 'number' && (
                  <span className="text-[10px] text-muted-foreground">{Math.round(f.age_days)}d</span>
                )}
                <span className="ml-auto">
                  <Select value={f.status} onValueChange={(v) => setStatus(f.id, v)}>
                    <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">offen</SelectItem>
                      <SelectItem value="planned">geplant</SelectItem>
                      <SelectItem value="in_progress">in Arbeit</SelectItem>
                      <SelectItem value="resolved">behoben</SelectItem>
                      <SelectItem value="accepted_risk">Risiko akzeptiert</SelectItem>
                    </SelectContent>
                  </Select>
                </span>
              </div>
              <div className="font-medium">{f.title}</div>
              {f.detail && <div className="text-xs text-muted-foreground">{f.detail}</div>}
              {f.recommendation && <div className="text-xs"><span className="text-muted-foreground">Empfehlung:</span> {f.recommendation}</div>}
            </div>
          ))}
          {!visible.length && <div className="text-sm text-muted-foreground">Keine Findings.</div>}
        </div>
      </CardContent>
    </Card>
  );
}
