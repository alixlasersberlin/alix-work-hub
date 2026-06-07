import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sbRepair } from '@/lib/repair/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, FileText, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_COLORS: Record<string, string> = {
  'Entwurf': 'bg-muted text-muted-foreground',
  'Versendet': 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  'Freigegeben': 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  'Abgelehnt': 'bg-red-500/20 text-red-300 border border-red-500/40',
};

export default function KostenvoranschlaegeList() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await sbRepair
        .from('repair_quotes')
        .select('id, quote_number, status, total_gross, created_at, sent_at, decided_at, repair_order_id, repair_orders(repair_number, customer_name, device_brand, device_model)')
        .order('created_at', { ascending: false })
        .limit(500);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (!q) return true;
    return (
      (r.quote_number || '').toLowerCase().includes(q) ||
      (r.repair_orders?.repair_number || '').toLowerCase().includes(q) ||
      (r.repair_orders?.customer_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche KV-Nr., Reparaturnr., Kunde…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="Entwurf">Entwurf</SelectItem>
            <SelectItem value="Versendet">Versendet</SelectItem>
            <SelectItem value="Freigegeben">Freigegeben</SelectItem>
            <SelectItem value="Abgelehnt">Abgelehnt</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KV-Nr.</TableHead>
              <TableHead>Reparatur</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Gerät</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Brutto</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead>Versendet</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Lädt…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Keine Kostenvoranschläge gefunden</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-medium">{r.quote_number}</TableCell>
                <TableCell>
                  <Link to={`/reparatur/${r.repair_order_id}`} className="text-primary hover:underline font-mono text-xs">
                    {r.repair_orders?.repair_number}
                  </Link>
                </TableCell>
                <TableCell>{r.repair_orders?.customer_name || '–'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{[r.repair_orders?.device_brand, r.repair_orders?.device_model].filter(Boolean).join(' ') || '–'}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[r.status] || ''} variant="outline">{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{Number(r.total_gross || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</TableCell>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString('de-DE')}</TableCell>
                <TableCell className="text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleDateString('de-DE') : '–'}</TableCell>
                <TableCell>
                  <Link to={`/reparatur/kostenvoranschlaege/${r.id}`}>
                    <Button size="sm" variant="outline"><FileText className="w-4 h-4 mr-1" />Öffnen</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Neue Kostenvoranschläge werden direkt im Reparaturauftrag erstellt (Tab „Kostenvoranschlag" oder Button „+ KV").
      </p>
    </div>
  );
}
