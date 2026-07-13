import { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ShoppingCart, Send, Trash2, Loader2 } from 'lucide-react';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

interface CartRow {
  id: string;
  item_id: string;
  quantity: number;
  note: string | null;
  country_iso: string | null;
  language_code: string | null;
  sku?: string;
  name?: string;
  brand?: string | null;
  price_gross?: number | null;
  price_net?: number | null;
  tax_rate?: number | null;
  currency?: string | null;
}

export default function CustomerPortalWarenkorb() {
  const ctx = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const c = supabase as any;
  const [portalUserId, setPortalUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState(ctx?.email ?? '');
  const [contactPhone, setContactPhone] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: pu } = await c.from('customer_portal_users').select('id').eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!pu) { setLoading(false); return; }
    setPortalUserId(pu.id);
    const { data: cart } = await c.from('catalog_portal_cart_items').select('*').eq('portal_user_id', pu.id).order('created_at');
    const items = cart ?? [];
    if (items.length === 0) { setRows([]); setLoading(false); return; }
    const itemIds = items.map((x: any) => x.item_id);
    // pick country from first row for pricing lookup
    const firstCountryIso = items[0].country_iso;
    const language = items[0].language_code ?? 'de';
    const [{ data: catItems }, { data: countries }] = await Promise.all([
      c.from('catalog_items').select('id, sku, name, brand').in('id', itemIds),
      c.from('catalog_countries').select('id, iso_code'),
    ]);
    const country = countries?.find((x: any) => x.iso_code === firstCountryIso);
    const [{ data: prices }, { data: descs }] = await Promise.all([
      country ? c.from('catalog_item_prices').select('item_id, uvp_net, uvp_gross, sale_net, sale_gross, tax_rate, currency_code').in('item_id', itemIds).eq('country_id', country.id).eq('price_status', 'freigegeben') : Promise.resolve({ data: [] }),
      c.from('catalog_item_descriptions').select('item_id, short_text').in('item_id', itemIds).eq('language_code', language),
    ]);
    const priceMap: Record<string, any> = {};
    (prices ?? []).forEach((p: any) => { priceMap[p.item_id] = p; });
    const itemMap: Record<string, any> = {};
    (catItems ?? []).forEach((i: any) => { itemMap[i.id] = i; });
    const merged: CartRow[] = items.map((r: any) => {
      const it = itemMap[r.item_id];
      const p = priceMap[r.item_id] ?? {};
      return {
        ...r,
        sku: it?.sku, name: it?.name, brand: it?.brand,
        price_gross: p.sale_gross ?? p.uvp_gross ?? null,
        price_net: p.sale_net ?? p.uvp_net ?? null,
        tax_rate: p.tax_rate ?? null,
        currency: p.currency_code ?? 'EUR',
      };
    });
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateQty = async (row: CartRow, qty: number) => {
    if (qty <= 0) return removeRow(row);
    const { error } = await c.from('catalog_portal_cart_items').update({ quantity: qty }).eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, quantity: qty } : r));
  };
  const removeRow = async (row: CartRow) => {
    const { error } = await c.from('catalog_portal_cart_items').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.filter(r => r.id !== row.id));
  };
  const updateNote = async (row: CartRow, note: string) => {
    const { error } = await c.from('catalog_portal_cart_items').update({ note }).eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, note } : r));
  };

  const totalGross = rows.reduce((s, r) => s + (Number(r.price_gross ?? 0) * Number(r.quantity)), 0);
  const currency = rows[0]?.currency ?? 'EUR';

  const submitInquiry = async () => {
    if (!portalUserId) return;
    if (rows.length === 0) { toast.error('Warenkorb ist leer.'); return; }
    setBusy(true);
    try {
      const first = rows[0];
      const { data: inq, error } = await c.from('catalog_portal_inquiries').insert({
        portal_user_id: portalUserId,
        message: message.trim() || null,
        contact_name: contactName || ctx?.companyName || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        desired_delivery_date: deliveryDate || null,
        country_iso: first.country_iso,
        language_code: first.language_code,
      }).select('id, inquiry_number').single();
      if (error) throw error;
      const positions = rows.map((r, i) => ({
        inquiry_id: inq.id,
        item_id: r.item_id,
        sku: r.sku, name: r.name,
        quantity: r.quantity, note: r.note,
        price_gross: r.price_gross, price_net: r.price_net,
        tax_rate: r.tax_rate, currency: r.currency,
        sort_order: i,
      }));
      const { error: e2 } = await c.from('catalog_portal_inquiry_items').insert(positions);
      if (e2) throw e2;
      // clear cart
      await c.from('catalog_portal_cart_items').delete().eq('portal_user_id', portalUserId);
      toast.success(`Sammelanfrage ${inq.inquiry_number} gesendet.`);
      setRows([]); setMessage('');
      navigate('/kunde');
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Warenkorb & Sammelanfrage</h2>
        <Badge variant="outline" className="ml-2">{rows.length} Positionen</Badge>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Lade…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Ihr Warenkorb ist leer. Fügen Sie Artikel im <a href="/kunde/katalog" className="text-primary underline">Katalog</a> hinzu.
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artikel</TableHead>
                    <TableHead className="w-24">Menge</TableHead>
                    <TableHead className="text-right">Preis</TableHead>
                    <TableHead className="text-right">Summe</TableHead>
                    <TableHead>Notiz</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.sku}</div>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={1} value={r.quantity}
                          onChange={(e) => updateQty(r, Number(e.target.value))} className="h-8 w-20" />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {r.price_gross != null ? `${Number(r.price_gross).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${r.currency}` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {r.price_gross != null ? `${(Number(r.price_gross) * r.quantity).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${r.currency}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Input defaultValue={r.note ?? ''} onBlur={(e) => updateNote(r, e.target.value)} className="h-8" placeholder="Anmerkung…" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeRow(r)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-3 flex items-center justify-end gap-2 border-t">
                <span className="text-sm text-muted-foreground">Zwischensumme (brutto):</span>
                <span className="text-lg font-semibold">{totalGross.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {currency}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Kontakt & Nachricht</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Ansprechpartner</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></div>
              <div><Label>E-Mail</Label><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
              <div><Label>Telefon</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
              <div><Label>Gewünschter Liefertermin</Label><Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
              <div className="md:col-span-2">
                <Label>Nachricht an unser Team</Label>
                <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Zusätzliche Informationen, Rückfragen, spezielle Konditionen…" />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={submitInquiry} disabled={busy} size="lg">
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Sammelanfrage senden
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
