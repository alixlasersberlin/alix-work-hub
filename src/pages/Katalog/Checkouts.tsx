import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Truck, FileText, Eye } from 'lucide-react';

interface Checkout {
  id: string;
  inquiry_id: string | null;
  customer_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  customer_reference: string | null;
  desired_date: string | null;
  delivery_address: any;
  notes: string | null;
  status: string;
  created_at: string;
}

const STATUSES = ['submitted', 'in_review', 'accepted', 'rejected', 'converted'];
const VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  submitted: 'default', in_review: 'secondary', accepted: 'outline', rejected: 'destructive', converted: 'outline',
};

export default function KatalogCheckouts() {
  const c = supabase as any;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Checkout[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detail, setDetail] = useState<Checkout | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [inquiryNo, setInquiryNo] = useState<string | null>(null);

  const load = async () => {
    let q = c.from('catalog_portal_checkouts').select('*').order('created_at', { ascending: false }).limit(200);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setRows(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  useEffect(() => {
    if (!detail) { setDetailItems([]); setInquiryNo(null); return; }
    (async () => {
      if (detail.inquiry_id) {
        const [{ data: items }, { data: inq }] = await Promise.all([
          c.from('catalog_portal_inquiry_items').select('*').eq('inquiry_id', detail.inquiry_id).order('sort_order'),
          c.from('catalog_portal_inquiries').select('inquiry_number').eq('id', detail.inquiry_id).maybeSingle(),
        ]);
        setDetailItems(items ?? []);
        setInquiryNo(inq?.inquiry_number ?? null);
      }
    })();
  }, [detail]);

  const setStatus = async (r: Checkout, s: string) => {
    const { error } = await c.from('catalog_portal_checkouts').update({ status: s }).eq('id', r.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, status: s } : x));
    if (detail?.id === r.id) setDetail({ ...detail, status: s });
  };

  const createOffer = async () => {
    if (!detail || detailItems.length === 0) { toast({ title: 'Keine Positionen', variant: 'destructive' }); return; }
    const lines = detailItems.map((i) => {
      const gross = Number(i.price_gross ?? 0);
      const tax = Number(i.tax_rate ?? 19);
      const net = i.price_net != null ? Number(i.price_net) : (tax > 0 ? gross / (1 + tax / 100) : gross);
      return {
        item_id: i.item_id ?? null,
        snapshot_id: i.snapshot_id ?? null,
        name: i.name ?? '',
        description: i.note ?? '',
        sku: i.sku ?? '',
        quantity: Number(i.quantity ?? 1),
        rate: Number(net.toFixed(2)),
        tax_percentage: tax,
      };
    });
    const handoff = {
      customer_id: detail.customer_id ?? null,
      notes: `Aus Portal-Checkout${inquiryNo ? ` (Anfrage ${inquiryNo})` : ''}${detail.notes ? `\n${detail.notes}` : ''}`,
      lines,
    };
    sessionStorage.setItem('portal_inquiry_handoff_v1', JSON.stringify(handoff));
    await setStatus(detail, 'converted');
    navigate('/verkauf/angebot/neu');
  };

  const addrStr = (a: any) => {
    if (!a || typeof a !== 'object') return '—';
    return [a.street, a.zip, a.city, a.country].filter(Boolean).join(', ') || '—';
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach(r => { m[r.status] = (m[r.status] ?? 0) + 1; });
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Portal-Sammelanfragen (Checkouts)</h2>
        <Badge variant="outline" className="ml-2 text-xs">{rows.length}</Badge>
        {STATUSES.map(s => counts[s] ? (
          <Badge key={s} variant={VARIANT[s] ?? 'outline'} className="text-[10px]">{s}: {counts[s]}</Badge>
        ) : null)}
        <div className="ml-auto w-56">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" />Eingegangene Checkouts</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Eingang</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Referenz</TableHead>
                <TableHead>Wunschtermin</TableHead>
                <TableHead>Lieferadresse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.contact_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.contact_email ?? '—'} {r.contact_phone ? `· ${r.contact_phone}` : ''}</div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.customer_reference ?? '—'}</TableCell>
                  <TableCell className="text-xs">{r.desired_date ?? '—'}</TableCell>
                  <TableCell className="text-xs max-w-[260px]">{addrStr(r.delivery_address)}</TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => setStatus(r, v)}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setDetail(r)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Checkouts.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Checkout-Details {inquiryNo && <span className="text-xs font-mono text-muted-foreground ml-2">Anfrage {inquiryNo}</span>}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Kontakt:</span> {detail.contact_name ?? '—'}</div>
                <div><span className="text-muted-foreground">E-Mail:</span> {detail.contact_email ?? '—'}</div>
                <div><span className="text-muted-foreground">Telefon:</span> {detail.contact_phone ?? '—'}</div>
                <div><span className="text-muted-foreground">Referenz:</span> {detail.customer_reference ?? '—'}</div>
                <div><span className="text-muted-foreground">Wunschtermin:</span> {detail.desired_date ?? '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Lieferadresse:</span> {addrStr(detail.delivery_address)}</div>
              </div>
              {detail.notes && <div className="bg-muted/40 p-3 rounded text-xs whitespace-pre-wrap">{detail.notes}</div>}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artikel</TableHead>
                    <TableHead className="w-16 text-right">Menge</TableHead>
                    <TableHead className="text-right">Preis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div>{i.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{i.sku}</div>
                      </TableCell>
                      <TableCell className="text-right">{Number(i.quantity)}</TableCell>
                      <TableCell className="text-right">
                        {i.price_gross != null ? `${Number(i.price_gross).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${i.currency ?? 'EUR'}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {detailItems.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-xs">Keine Positionen verknüpft</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDetail(null)}>Schließen</Button>
                <Button onClick={createOffer} disabled={detailItems.length === 0}>
                  <FileText className="h-4 w-4 mr-2" /> Angebot erstellen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
