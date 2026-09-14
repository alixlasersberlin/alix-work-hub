import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

const STATI = ['OFFEN', 'GEPRUEFT', 'IGNORIERT', 'KORREKTUR_ERFORDERLICH'] as const;
const LABEL: Record<string, string> = {
  OFFEN: 'Offen', GEPRUEFT: 'Geprüft', IGNORIERT: 'Ignoriert', KORREKTUR_ERFORDERLICH: 'Korrektur erforderlich',
};

export default function GobdKonflikte() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('OFFEN');

  async function load() {
    setLoading(true);
    let q: any = (supabase as any).from('gobd_sync_conflicts').select('*').order('detected_at', { ascending: false }).limit(500);
    if (filter !== 'alle') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function setStatus(id: string, status: string) {
    const { error } = await (supabase as any).from('gobd_sync_conflicts')
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: (await supabase.auth.getUser()).data.user?.id ?? null })
      .eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Status gespeichert');
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={AlertTriangle}
        title="Synchronisationskonflikte"
        subtitle="Abweichende Rechnungsdaten aus externen Systemen — finalisierte Rechnungen werden nie überschrieben"
        actions={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm">{loading ? 'Lädt…' : `${rows.length} Einträge`}</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              {STATI.map(s => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead><TableHead>Rechnung</TableHead><TableHead>Quelle</TableHead>
                <TableHead>Feld</TableHead><TableHead>AlixWork-Wert</TableHead><TableHead>Externer Wert</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && !loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Konflikte</TableCell></TableRow>
              )}
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.detected_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell className="text-xs font-mono">{r.invoice_number || r.invoice_id?.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">{r.source}{r.zoho_reference ? ` · ${r.zoho_reference}` : ''}</TableCell>
                  <TableCell className="text-xs font-mono">{r.field}</TableCell>
                  <TableCell className="text-xs max-w-[220px] truncate" title={r.local_value ?? ''}>{r.local_value ?? '—'}</TableCell>
                  <TableCell className="text-xs max-w-[220px] truncate" title={r.external_value ?? ''}>{r.external_value ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === 'OFFEN' ? 'destructive' : 'outline'}>{LABEL[r.status] ?? r.status}</Badge>
                      <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
                        <SelectTrigger className="w-[190px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATI.map(s => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-[11px] text-muted-foreground mt-4">
            Eine inhaltliche Korrektur einer fertigen Rechnung erfolgt ausschließlich über Storno, Gutschrift oder Berichtigung.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
