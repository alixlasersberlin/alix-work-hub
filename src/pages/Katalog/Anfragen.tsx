import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { MessageSquare, Search, ChevronRight, FileText } from 'lucide-react';

interface Inquiry {
  id: string; inquiry_number: string; status: string; message: string | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  desired_delivery_date: string | null; country_iso: string | null; language_code: string | null;
  internal_notes: string | null; created_at: string; portal_user_id: string;
}
interface InquiryItem {
  id: string; sku: string | null; name: string | null; quantity: number; note: string | null;
  price_gross: number | null; price_net: number | null; tax_rate: number | null; currency: string | null;
}

const STATUS = ['neu', 'in_bearbeitung', 'angebot_erstellt', 'abgeschlossen', 'abgelehnt'];

export default function KatalogAnfragen() {
  const c = supabase as any;
  const navigate = useNavigate();
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({});
  const [customerIdMap, setCustomerIdMap] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await c.from('catalog_portal_inquiries').select('*').order('created_at', { ascending: false }).limit(500);
    const list: Inquiry[] = data ?? [];
    setRows(list);
    // Map portal users -> customer companies
    const puIds = Array.from(new Set(list.map(x => x.portal_user_id)));
    if (puIds.length) {
      const { data: pus } = await c.from('customer_portal_users').select('id, customer_id, customers:customer_id(company_name)').in('id', puIds);
      const m: Record<string, string> = {};
      const cm: Record<string, string> = {};
      (pus ?? []).forEach((p: any) => {
        m[p.id] = p.customers?.company_name ?? '—';
        if (p.customer_id) cm[p.id] = p.customer_id;
      });
      setCustomerMap(m);
      setCustomerIdMap(cm);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selected) { setItems([]); return; }
    c.from('catalog_portal_inquiry_items').select('*').eq('inquiry_id', selected.id).order('sort_order').then(({ data }: any) => setItems(data ?? []));
  }, [selected]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!n) return true;
      return (r.inquiry_number ?? '').toLowerCase().includes(n)
        || (r.contact_name ?? '').toLowerCase().includes(n)
        || (r.contact_email ?? '').toLowerCase().includes(n)
        || (customerMap[r.portal_user_id] ?? '').toLowerCase().includes(n);
    });
  }, [rows, q, statusFilter, customerMap]);

  const setStatus = async (r: Inquiry, status: string) => {
    const { error } = await c.from('catalog_portal_inquiries').update({ status, processed_at: status === 'abgeschlossen' ? new Date().toISOString() : null }).eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Status aktualisiert');
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, status } : x));
    if (selected?.id === r.id) setSelected({ ...selected, status });
  };
  const saveNotes = async (r: Inquiry, notes: string) => {
    const { error } = await c.from('catalog_portal_inquiries').update({ internal_notes: notes }).eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Notizen gespeichert');
  };

  const createOffer = async (r: Inquiry) => {
    if (!items.length) { toast.error('Keine Positionen vorhanden'); return; }
    const handoff = {
      customer_id: customerIdMap[r.portal_user_id] ?? null,
      notes: `Aus Portal-Anfrage ${r.inquiry_number}${r.message ? `\n${r.message}` : ''}`,
      lines: items.map((i) => {
        const gross = Number(i.price_gross ?? 0);
        const tax = Number(i.tax_rate ?? 19);
        const net = i.price_net != null ? Number(i.price_net) : (tax > 0 ? gross / (1 + tax / 100) : gross);
        return {
          name: i.name ?? '',
          description: i.note ?? '',
          sku: i.sku ?? '',
          quantity: Number(i.quantity ?? 1),
          rate: Number(net.toFixed(2)),
          tax_percentage: tax,
        };
      }),
    };
    sessionStorage.setItem('portal_inquiry_handoff_v1', JSON.stringify(handoff));
    await setStatus(r, 'angebot_erstellt');
    navigate('/verkauf/angebot/neu');
  };

  const total = items.reduce((s, i) => s + Number(i.price_gross ?? 0) * Number(i.quantity), 0);
  const currency = items[0]?.currency ?? 'EUR';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Sammelanfragen aus Portal</h2>
        <Badge variant="outline" className="ml-2 text-xs">{rows.length}</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-64" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Anfragen</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-[560px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id} className={`cursor-pointer ${selected?.id === r.id ? 'bg-primary/5' : ''}`} onClick={() => setSelected(r)}>
                    <TableCell className="font-mono text-xs">{r.inquiry_number}</TableCell>
                    <TableCell className="text-sm">{customerMap[r.portal_user_id] ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('de-DE')}</TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Keine Anfragen</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">
            {selected ? `${selected.inquiry_number} — Details` : 'Anfrage wählen'}
          </CardTitle></CardHeader>
          <CardContent>
            {!selected ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Bitte eine Anfrage aus der Liste wählen.</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Kunde:</span> {customerMap[selected.portal_user_id] ?? '—'}</div>
                  <div><span className="text-muted-foreground">Kontakt:</span> {selected.contact_name ?? '—'}</div>
                  <div><span className="text-muted-foreground">E-Mail:</span> {selected.contact_email ?? '—'}</div>
                  <div><span className="text-muted-foreground">Telefon:</span> {selected.contact_phone ?? '—'}</div>
                  <div><span className="text-muted-foreground">Land:</span> {selected.country_iso ?? '—'}</div>
                  <div><span className="text-muted-foreground">Wunsch-Liefertermin:</span> {selected.desired_delivery_date ?? '—'}</div>
                </div>
                {selected.message && (
                  <div className="text-sm bg-muted/40 p-3 rounded">
                    <div className="text-xs text-muted-foreground mb-1">Nachricht</div>
                    {selected.message}
                  </div>
                )}
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={selected.status} onValueChange={(v) => setStatus(selected, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artikel</TableHead>
                      <TableHead className="w-16 text-right">Menge</TableHead>
                      <TableHead className="text-right">Preis (brutto)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(i => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <div className="text-sm">{i.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{i.sku}</div>
                          {i.note && <div className="text-xs italic mt-1">„{i.note}"</div>}
                        </TableCell>
                        <TableCell className="text-right text-sm">{Number(i.quantity)}</TableCell>
                        <TableCell className="text-right text-sm">
                          {i.price_gross != null ? `${Number(i.price_gross).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${i.currency}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-xs">Keine Positionen</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="text-right text-sm font-semibold">
                  Summe: {total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currency}
                </div>
                <div>
                  <Label className="text-xs">Interne Notizen</Label>
                  <Textarea rows={3} defaultValue={selected.internal_notes ?? ''} onBlur={(e) => saveNotes(selected, e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
