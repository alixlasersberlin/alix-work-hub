import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Banknote, ExternalLink, CheckCircle2, X } from 'lucide-react';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';

const STATUS_LABEL: Record<string, string> = {
  offen: 'Offen',
  übernommen: 'Übernommen',
  abgelehnt: 'Abgelehnt',
};

export default function Rechnungsvorschlaege() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<'offen' | 'alle' | 'übernommen' | 'abgelehnt'>('offen');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('repair_invoice_proposals').select('*').order('created_at', { ascending: false });
    if (filter !== 'alle') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const setStatus = async (id: string, status: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('repair_invoice_proposals')
      .update({ status, processed_by: u?.user?.id || null, processed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Status aktualisiert' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Banknote className="w-6 h-6 text-emerald-400" />
        <h1 className="text-2xl font-bold">Rechnungsvorschläge (Reparaturen)</h1>
        <div className="ml-auto">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="übernommen">Übernommen</SelectItem>
              <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
              <SelectItem value="alle">Alle</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Lade…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Keine Vorschläge.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Reparatur</th>
                  <th className="px-3 py-2 text-left">Ticket</th>
                  <th className="px-3 py-2 text-left">Kunde</th>
                  <th className="px-3 py-2 text-left">Gerät</th>
                  <th className="px-3 py-2 text-right">Arbeit (h)</th>
                  <th className="px-3 py-2 text-right">Versand</th>
                  <th className="px-3 py-2 text-right">Ersatzteile</th>
                  <th className="px-3 py-2 text-right">Gesamt</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Erstellt</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">
                      <Link to={`/reparatur/${r.repair_order_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                        {r.repair_number} <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.ticket_id ? (
                        <Link to={`/tickets/${r.ticket_id}`} className="text-primary hover:underline">{r.ticket_number || '–'}</Link>
                      ) : '–'}
                    </td>
                    <td className="px-3 py-2">
                      <div>{r.customer_name || '–'}</div>
                      {r.customer_company && <div className="text-xs text-muted-foreground">{r.customer_company}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div>{r.device_label || '–'}</div>
                      {r.device_serial && <div className="text-xs text-muted-foreground font-mono">{r.device_serial}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">{Number(r.labor_hours || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.shipping_cost || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{Array.isArray(r.parts) ? r.parts.length : 0}</td>
                    <td className="px-3 py-2 text-right font-semibold">{Number(r.total_amount || 0).toFixed(2)} {r.currency || 'EUR'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === 'offen' ? 'default' : r.status === 'übernommen' ? 'secondary' : 'destructive'}>
                        {STATUS_LABEL[r.status] || r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                    <td className="px-3 py-2">
                      {r.status === 'offen' && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-300" onClick={() => setStatus(r.id, 'übernommen')}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Übernehmen
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-500/40 text-red-300" onClick={() => setStatus(r.id, 'abgelehnt')}>
                            <X className="w-3 h-3 mr-1" /> Ablehnen
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
