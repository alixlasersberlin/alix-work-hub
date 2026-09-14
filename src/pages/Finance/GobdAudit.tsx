import { useEffect, useMemo, useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

const OBJEKTE = ['alle', 'invoice', 'export', 'order', 'payment', 'bank', 'backup'];

export default function GobdAudit() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [objekt, setObjekt] = useState('alle');
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    let query: any = (supabase as any).from('gobd_audit_unified').select('*')
      .gte('ts', from + 'T00:00:00').lte('ts', to + 'T23:59:59')
      .order('ts', { ascending: false }).limit(1000);
    if (objekt !== 'alle') query = query.eq('object_type', objekt);
    const { data, error } = await query;
    if (error) toast.error(error.message); else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to, objekt]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(s));
  }, [q, rows]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={ScrollText}
        title="GoBD Audit-Protokoll"
        subtitle="Zentrale Sicht auf alle Protokolle: Rechnungen, Nummern, Zahlungen, Exporte, Perioden, Sicherungen"
        actions={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>}
      />

      <Card>
        <CardHeader><CardTitle className="text-sm">Filter</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" /></div>
          <div className="min-w-[180px]"><Label>Objekttyp</Label>
            <Select value={objekt} onValueChange={setObjekt}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{OBJEKTE.map(o => <SelectItem key={o} value={o}>{o === 'alle' ? 'Alle' : o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[220px]"><Label>Suche (Aktion, Benutzer, Objekt)</Label>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="z. B. INVOICE_ oder EXPORT_" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">{loading ? 'Lädt…' : `${filtered.length} Einträge (max. 1000)`}</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeit</TableHead><TableHead>Benutzer/System</TableHead><TableHead>Aktion</TableHead>
                <TableHead>Objekt</TableHead><TableHead>Quelle</TableHead><TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Keine Einträge</TableCell></TableRow>
              )}
              {filtered.map(r => (
                <TableRow key={`${r.origin}-${r.id}`}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.ts).toLocaleString('de-DE')}</TableCell>
                  <TableCell className="text-xs font-mono">{r.user_id ? String(r.user_id).slice(0, 8) : 'System'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.action}</Badge></TableCell>
                  <TableCell className="text-xs">{r.object_type}{r.object_id ? ` · ${String(r.object_id).slice(0, 12)}` : ''}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.source ?? r.origin}</TableCell>
                  <TableCell>
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground">anzeigen</summary>
                      <pre className="mt-2 max-w-2xl overflow-auto rounded bg-muted p-2 text-[10px]">
{JSON.stringify({ grund: r.reason, daten: r.metadata }, null, 2)}
                      </pre>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-[11px] text-muted-foreground mt-4">
            Protokolleinträge können nicht geändert oder gelöscht werden — auch nicht durch Administratoren.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
