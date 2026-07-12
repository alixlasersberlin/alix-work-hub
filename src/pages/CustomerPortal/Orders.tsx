import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Loader2, RotateCw, ChevronDown, ChevronRight, CalendarClock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Ctx = { customerId: string; companyName: string | null };

const fmtEur = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n));

export default function CustomerPortalOrders() {
  const ctx = useOutletContext<Ctx>();
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [dateDlg, setDateDlg] = useState<{ order: any; date: string; note: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, order_date, total_amount, source_system')
        .eq('customer_id', ctx.customerId)
        .order('order_date', { ascending: false })
        .limit(100);
      setOrders(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  const toggleOpen = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!items[id]) {
      const { data } = await supabase
        .from('order_items')
        .select('id, item_name, sku, quantity, rate, amount')
        .eq('order_id', id);
      setItems(prev => ({ ...prev, [id]: data ?? [] }));
    }
  };

  const reorder = async (o: any) => {
    setBusy(o.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const list = items[o.id] ?? (await supabase.from('order_items').select('item_name, sku, quantity').eq('order_id', o.id)).data ?? [];
      const bodyLines = list.map((it: any) => `• ${it.quantity}× ${it.item_name}${it.sku ? ` (${it.sku})` : ''}`).join('\n');
      const { error } = await supabase.from('customer_portal_tickets').insert({
        customer_id: ctx.customerId,
        created_by: user?.id ?? null,
        subject: `Nachbestellung zu ${o.order_number ?? o.id.slice(0, 8)}`,
        category: 'reorder',
        priority: 'normal',
        status: 'open',
        message: `Kunde ${ctx.companyName ?? ''} bittet um Nachbestellung folgender Positionen aus Auftrag ${o.order_number}:\n\n${bodyLines || '(keine Positionen gefunden)'}`,
      } as any);
      if (error) throw error;
      toast.success('Nachbestellungs-Anfrage wurde gesendet. Unser Team meldet sich in Kürze.');
    } catch (e: any) {
      toast.error(e?.message || 'Anfrage konnte nicht gesendet werden');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Meine Bestellungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : orders.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Noch keine Bestellungen vorhanden.</p>
        ) : orders.map(o => {
          const isAt = o.source_system === 'zoho_eu_2';
          const suffix = isAt ? '-AT' : '';
          const isOpen = openId === o.id;
          return (
            <div key={o.id} className="border border-border rounded-md">
              <button
                onClick={() => toggleOpen(o.id)}
                className="w-full p-4 flex items-start justify-between gap-3 hover:bg-muted/40 text-left"
              >
                <div className="flex items-start gap-2 min-w-0">
                  {isOpen ? <ChevronDown className="w-4 h-4 mt-1 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{o.order_number}{suffix}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'} · {fmtEur(o.total_amount)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="flex-shrink-0">{o.status ?? '—'}</Badge>
              </button>

              {isOpen && (
                <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                  {(items[o.id] ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Keine Positionen erfasst.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border/50">
                            <th className="py-1.5">Artikel</th>
                            <th className="text-right py-1.5">Menge</th>
                            <th className="text-right py-1.5">Preis</th>
                            <th className="text-right py-1.5">Summe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items[o.id].map((it: any) => (
                            <tr key={it.id} className="border-b border-border/30">
                              <td className="py-1.5">
                                <div className="font-medium">{it.item_name}</div>
                                {it.sku && <div className="text-muted-foreground">{it.sku}</div>}
                              </td>
                              <td className="text-right py-1.5">{it.quantity}</td>
                              <td className="text-right py-1.5">{fmtEur(it.rate)}</td>
                              <td className="text-right py-1.5">{fmtEur(it.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDateDlg({ order: o, date: '', note: '' })}
                    >
                      <CalendarClock className="w-4 h-4 mr-1" /> Wunsch-Liefertermin
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => reorder(o)}
                      disabled={busy === o.id}
                      className="gold-gradient"
                    >
                      {busy === o.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCw className="w-4 h-4 mr-1" />}
                      Nachbestellen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!dateDlg} onOpenChange={(o) => !o && setDateDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Wunsch-Liefertermin angeben</DialogTitle></DialogHeader>
          {dateDlg && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Auftrag <b>{dateDlg.order.order_number}</b>. Wir prüfen die Verfügbarkeit und melden uns zurück.
              </p>
              <div>
                <Label>Wunschtermin</Label>
                <Input type="date" value={dateDlg.date} min={new Date(Date.now() + 86400e3).toISOString().slice(0, 10)}
                  onChange={(e) => setDateDlg({ ...dateDlg, date: e.target.value })} />
              </div>
              <div>
                <Label>Anmerkung (optional)</Label>
                <Textarea value={dateDlg.note} onChange={(e) => setDateDlg({ ...dateDlg, note: e.target.value })}
                  placeholder="z. B. bevorzugte Uhrzeit, Zugangshinweise …" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDateDlg(null)}>Abbrechen</Button>
            <Button
              disabled={!dateDlg?.date || busy === 'date'}
              onClick={async () => {
                if (!dateDlg?.date) return;
                setBusy('date');
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  const { error } = await supabase.from('customer_portal_tickets').insert({
                    customer_id: ctx.customerId,
                    created_by: user?.id ?? null,
                    subject: `Wunsch-Liefertermin ${dateDlg.order.order_number}: ${new Date(dateDlg.date).toLocaleDateString('de-DE')}`,
                    category: 'delivery_date',
                    priority: 'normal',
                    status: 'open',
                    message: `Kunde ${ctx.companyName ?? ''} wünscht Lieferung von Auftrag ${dateDlg.order.order_number} am ${new Date(dateDlg.date).toLocaleDateString('de-DE')}.\n\nAnmerkung: ${dateDlg.note || '—'}`,
                  } as any);
                  if (error) throw error;
                  toast.success('Wunsch-Liefertermin übermittelt.');
                  setDateDlg(null);
                } catch (e: any) {
                  toast.error(e?.message || 'Konnte nicht übermittelt werden');
                } finally { setBusy(null); }
              }}
              className="gold-gradient"
            >
              {busy === 'date' && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
