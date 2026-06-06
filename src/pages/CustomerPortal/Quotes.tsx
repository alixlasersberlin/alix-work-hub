import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck2, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Ctx = { customerId: string };

export default function CustomerPortalQuotes() {
  const ctx = useOutletContext<Ctx>();
  const [orders, setOrders] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ orderId: string; action: 'accepted' | 'rejected' } | null>(null);
  const [signedName, setSignedName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [o, r] = await Promise.all([
      supabase.from('orders')
        .select('id, order_number, order_status, total_amount, created_at')
        .eq('customer_id', ctx.customerId)
        .order('created_at', { ascending: false }),
      supabase.from('customer_portal_quote_responses')
        .select('order_id, response, responded_at, signed_name')
        .eq('customer_id', ctx.customerId),
    ]);
    setOrders(o.data ?? []);
    const map: Record<string, any> = {};
    (r.data ?? []).forEach((x: any) => { if (x.order_id) map[x.order_id] = x; });
    setResponses(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ctx.customerId]);

  const submit = async () => {
    if (!open) return;
    if (!signedName.trim()) return toast.error('Bitte Namen für die digitale Unterschrift eintragen');
    setSubmitting(true);
    const { error } = await supabase.from('customer_portal_quote_responses').insert({
      customer_id: ctx.customerId,
      order_id: open.orderId,
      response: open.action,
      signed_name: signedName,
      note: note || null,
      user_agent: navigator.userAgent,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(open.action === 'accepted' ? 'Angebot angenommen' : 'Angebot abgelehnt');
    setOpen(null); setSignedName(''); setNote('');
    load();
  };

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="w-5 h-5" /> Aufträge & Angebote</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : orders.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">Aktuell keine Aufträge.</p>
          ) : (
            <div className="border border-border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nummer</TableHead><TableHead>Status</TableHead>
                    <TableHead>Datum</TableHead><TableHead>Betrag</TableHead>
                    <TableHead>Ihre Antwort</TableHead><TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const resp = responses[o.id];
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                        <TableCell><Badge variant="outline">{o.order_status ?? '—'}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString('de-DE')}</TableCell>
                        <TableCell className="text-xs">
                          {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—'}
                        </TableCell>
                        <TableCell>
                          {resp ? (
                            <Badge className={resp.response === 'accepted' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}>
                              {resp.response === 'accepted' ? 'Angenommen' : 'Abgelehnt'}
                            </Badge>
                          ) : <Badge variant="secondary">Offen</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          {!resp && (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="default" onClick={() => setOpen({ orderId: o.id, action: 'accepted' })}>
                                <Check className="w-4 h-4 mr-1" /> Annehmen
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setOpen({ orderId: o.id, action: 'rejected' })}>
                                <X className="w-4 h-4 mr-1" /> Ablehnen
                              </Button>
                            </div>
                          )}
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

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open?.action === 'accepted' ? 'Angebot annehmen' : 'Angebot ablehnen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bitte bestätigen Sie Ihre Entscheidung mit Ihrem vollständigen Namen. Diese Aktion wird mit Zeitstempel protokolliert.
            </p>
            <div>
              <label className="text-sm">Name (digitale Unterschrift)</label>
              <Input value={signedName} onChange={(e) => setSignedName(e.target.value)} placeholder="Max Mustermann" />
            </div>
            <div>
              <label className="text-sm">Anmerkung (optional)</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Abbrechen</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
