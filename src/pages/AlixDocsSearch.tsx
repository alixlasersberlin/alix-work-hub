import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Files, Search, Loader2, Eye, ExternalLink, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

type Doc = {
  id: string;
  title: string;
  original_filename: string | null;
  serial_number: string | null;
  document_date: string | null;
  created_at: string;
  status: string;
  confidentiality_level: string;
  current_version: number;
  mime_type: string;
  file_size: number;
  order_id: string | null;
  customer_id: string | null;
  category_id: string | null;
  source: string | null;
};
type Cat = { id: string; code: string; name: string };
type Order = { id: string; order_number: string | null; customer_id: string | null };
type Customer = { id: string; name: string | null; customer_number: string | null };

export default function AlixDocsSearch() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    let query = supabase.from('alixdocs_documents')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (catFilter !== 'all') {
      const cat = cats.find(c => c.code === catFilter);
      if (cat) query = query.eq('category_id', cat.id);
    }
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
    if (q) {
      const s = `%${q}%`;
      query = query.or(`title.ilike.${s},description.ilike.${s},original_filename.ilike.${s},serial_number.ilike.${s}`);
    }
    const { data, error } = await query;
    if (error) toast.error(error.message);
    const rows = (data ?? []) as Doc[];
    setDocs(rows);

    const orderIds = [...new Set(rows.map(r => r.order_id).filter(Boolean))] as string[];
    const custIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))] as string[];
    if (orderIds.length) {
      const { data: o } = await supabase.from('orders')
        .select('id, order_number, customer_id').in('id', orderIds);
      setOrders(Object.fromEntries((o ?? []).map((r: any) => [r.id, r])));
    }
    if (custIds.length) {
      const { data: c } = await supabase.from('customers')
        .select('id, name, customer_number').in('id', custIds);
      setCustomers(Object.fromEntries((c ?? []).map((r: any) => [r.id, r])));
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('alixdocs_categories').select('id, code, name').order('sort_order').then(({ data }) => setCats((data ?? []) as Cat[]));
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [catFilter, statusFilter, dateFrom, dateTo]);

  const catMap = useMemo(() => Object.fromEntries(cats.map(c => [c.id, c])), [cats]);

  const openDoc = async (d: Doc) => {
    const { data, error } = await supabase.functions.invoke('alixdocs-signed-url', {
      body: { document_id: d.id, version_number: d.current_version },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    window.open((data as any).url, '_blank');
  };

  const confBadge = (l: string) => l === 'streng_vertraulich'
    ? <Badge className="bg-red-500/15 text-red-400"><ShieldAlert className="w-3 h-3 mr-1" />streng</Badge>
    : l === 'vertraulich' ? <Badge className="bg-amber-500/15 text-amber-400">vertraulich</Badge> : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Files className="w-5 h-5" /> AlixDocs — Globale Dokumentensuche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Titel, Dateiname, Seriennummer…"
                     value={q} onChange={(e) => setQ(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && load()} />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger><SelectValue placeholder="Kategorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {cats.map(c => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="entwurf">Entwurf</SelectItem>
                <SelectItem value="geprueft">Geprüft</SelectItem>
                <SelectItem value="freigegeben">Freigegeben</SelectItem>
                <SelectItem value="archiviert">Archiviert</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <div className="flex gap-2">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <Button onClick={load}>Suchen</Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Suche…
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Keine Dokumente gefunden.</div>
          ) : (
            <div className="border border-border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Auftrag</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map(d => {
                    const o = d.order_id ? orders[d.order_id] : null;
                    const c = d.customer_id ? customers[d.customer_id] : null;
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="font-medium">{d.title}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {d.original_filename && <span className="text-[11px] text-muted-foreground font-mono">{d.original_filename}</span>}
                            {confBadge(d.confidentiality_level)}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{catMap[d.category_id ?? '']?.name ?? '—'}</Badge></TableCell>
                        <TableCell className="text-xs">
                          {o ? (
                            <Link to={`/auftraege/${o.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                              {o.order_number ?? o.id.slice(0, 8)} <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c ? `${c.customer_number ?? ''} ${c.name ?? ''}`.trim() : '—'}
                        </TableCell>
                        <TableCell>v{d.current_version}</TableCell>
                        <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(d.created_at).toLocaleDateString('de-DE')}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openDoc(d)}><Eye className="w-4 h-4" /></Button>
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
    </div>
  );
}
