import { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, Filter, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const fmt = (n: number) => (n == null ? '' : Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }));

export default function Buchungsjournal() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [src, setSrc] = useState('alle');
  const [status, setStatus] = useState('alle');

  async function load() {
    setLoading(true);
    let q: any = (supabase as any).from('finance_journal').select('*').gte('booking_date', from).lte('booking_date', to).order('booking_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000);
    if (src !== 'alle') q = q.eq('source_module', src);
    if (status !== 'alle') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-line */ }, [from, to, src, status]);

  function exportCsv() {
    const cols = ['journal_number','booking_date','source_module','vorgang','reference','order_number','invoice_number','amount_net','amount_vat','amount_gross','account','contra_account','description','status'];
    const head = cols.join(';');
    const body = rows.map(r => cols.map(c => String(r[c] ?? '').replace(/[;\n\r"]/g, ' ')).join(';')).join('\n');
    const blob = new Blob([head + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `journal_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={ScrollText} title="Buchungsjournal" subtitle="Lückenlose Dokumentation aller Finanzbewegungen (GoBD)"
        actions={<Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>} />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Filter className="h-4 w-4" />Filter</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="min-w-[180px]"><Label>Modul</Label>
            <Select value={src} onValueChange={setSrc}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['alle','cashbook','bank','manual','order','invoice','deposit','payment','zoho'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]"><Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['alle','aktiv','storniert','korrigiert'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Journaleinträge ({rows.length})</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Journal-Nr.</TableHead><TableHead>Datum</TableHead><TableHead>Modul</TableHead>
                <TableHead>Vorgang</TableHead><TableHead>Referenz</TableHead>
                <TableHead className="text-right">Netto</TableHead><TableHead className="text-right">MwSt.</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead>Konto</TableHead><TableHead>Gegenkto.</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={11}>Lädt…</TableCell></TableRow>
                : rows.length === 0 ? <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">Keine Einträge</TableCell></TableRow>
                : rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.journal_number}</TableCell>
                    <TableCell>{r.booking_date}</TableCell>
                    <TableCell><Badge variant="outline">{r.source_module}</Badge></TableCell>
                    <TableCell>{r.vorgang}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference || r.order_number || r.invoice_number}</TableCell>
                    <TableCell className="text-right">{fmt(r.amount_net)}</TableCell>
                    <TableCell className="text-right">{fmt(r.amount_vat)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(r.amount_gross)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.account}</TableCell>
                    <TableCell className="font-mono text-xs">{r.contra_account}</TableCell>
                    <TableCell><Badge variant={r.status === 'aktiv' ? 'outline' : 'destructive'}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
