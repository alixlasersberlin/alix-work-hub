import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Loader2, Search } from 'lucide-react';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string };
type Offer = {
  id: string; offer_number: string; offer_date: string | null; valid_until: string | null;
  total_net: number | null; total_tax: number | null; total_gross: number | null;
  status: string; customer_visible: boolean; portal_version: number | null;
};

const STATUS_FILTERS = [
  { value: 'alle', label: 'Alle' },
  { value: 'offen', label: 'Offen' },
  { value: 'angenommen', label: 'Angenommen' },
  { value: 'abgelehnt', label: 'Abgelehnt' },
  { value: 'abgelaufen', label: 'Abgelaufen' },
];

export default function CustomerPortalOffers() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('alle');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('offers')
        .select('id, offer_number, offer_date, valid_until, total_net, total_tax, total_gross, status, customer_visible, portal_version')
        .eq('customer_id', ctx.customerId)
        .eq('customer_visible', true)
        .order('offer_date', { ascending: false });
      setRows((data ?? []) as Offer[]);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  const now = Date.now();
  const filtered = rows.filter((o) => {
    const expired = o.valid_until && new Date(o.valid_until).getTime() < now;
    const openish = ['versendet', 'geöffnet', 'entwurf'].includes(o.status.toLowerCase());
    const bucket =
      o.status.toLowerCase() === 'angenommen' ? 'angenommen'
      : o.status.toLowerCase() === 'abgelehnt' ? 'abgelehnt'
      : expired && openish ? 'abgelaufen'
      : openish ? 'offen'
      : 'sonstige';
    if (filter !== 'alle' && bucket !== filter) return false;
    if (search && !o.offer_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Meine Angebote</CardTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Angebotsnummer" className="pl-8 w-[220px]" />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_FILTERS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">Keine Angebote gefunden.</p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Gültig bis</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => {
                  const expired = o.valid_until && new Date(o.valid_until).getTime() < now;
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.offer_number}</TableCell>
                      <TableCell className="text-xs">{o.offer_date ? new Date(o.offer_date).toLocaleDateString('de-DE') : '—'}</TableCell>
                      <TableCell className="text-xs">{o.valid_until ? new Date(o.valid_until).toLocaleDateString('de-DE') : '—'}</TableCell>
                      <TableCell className="text-right text-xs">{fmt(o.total_net)}</TableCell>
                      <TableCell className="text-right text-xs">{fmt(o.total_gross)}</TableCell>
                      <TableCell>
                        <Badge variant={expired ? 'outline' : 'secondary'}>{expired ? 'abgelaufen' : o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline" onClick={() => logPortalAudit({ action: 'invoice_opened', customerId: ctx.customerId, objectType: 'offer', objectId: o.id })}>
                          <Link to={`/kunde/angebote/${o.id}`}>Öffnen</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function fmt(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
