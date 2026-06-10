import { useEffect, useState } from 'react';
import { ShoppingCart, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard, PageEmpty } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

export default function FinanceP2P() {
  const [loading, setLoading] = useState(true);
  const [prs, setPrs] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [grs, setGrs] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);

  const [newPr, setNewPr] = useState({ description: '', quantity: '1', unit_price: '0', needed_by: '' });

  const fmt = (n: number, c = 'EUR') =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: c }).format(Number(n ?? 0));

  const load = async () => {
    setLoading(true);
    const [{ data: pr }, { data: po }, { data: gr }, { data: m }] = await Promise.all([
      supabase.from('finance_purchase_requisitions' as any).select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('finance_purchase_orders' as any).select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('finance_goods_receipts' as any).select('*').order('received_at', { ascending: false }).limit(50),
      supabase.from('finance_three_way_matches' as any).select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setPrs((pr ?? []) as any);
    setPos((po ?? []) as any);
    setGrs((gr ?? []) as any);
    setMatches((m ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createPr = async () => {
    if (!newPr.description) return toast({ title: 'Beschreibung fehlt', variant: 'destructive' });
    const qty = Number(newPr.quantity); const price = Number(newPr.unit_price);
    const { data: ins, error } = await supabase.from('finance_purchase_requisitions' as any).insert({
      status: 'draft',
      total_amount: qty * price,
      needed_by: newPr.needed_by || null,
      notes: newPr.description,
    }).select('id').single();
    if (error || !ins) return toast({ title: 'Fehler', description: error?.message, variant: 'destructive' });
    await supabase.from('finance_purchase_requisition_items' as any).insert({
      requisition_id: (ins as any).id,
      description: newPr.description,
      quantity: qty,
      unit_price: price,
    });
    setNewPr({ description: '', quantity: '1', unit_price: '0', needed_by: '' });
    load();
  };

  const approvePr = async (id: string) => {
    const { error } = await supabase.from('finance_purchase_requisitions' as any)
      .update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else load();
  };

  const convertToPo = async (pr: any) => {
    const { data: items } = await supabase.from('finance_purchase_requisition_items' as any)
      .select('*').eq('requisition_id', pr.id);
    const { data: po, error } = await supabase.from('finance_purchase_orders' as any).insert({
      requisition_id: pr.id,
      supplier_id: pr.supplier_id,
      tenant_id: pr.tenant_id,
      status: 'open',
      total_amount: pr.total_amount,
      currency: pr.currency,
      ordered_at: new Date().toISOString().slice(0, 10),
    }).select('id').single();
    if (error || !po) return toast({ title: 'Fehler', description: error?.message, variant: 'destructive' });
    if (items && items.length) {
      await supabase.from('finance_purchase_order_items' as any).insert(
        (items as any[]).map((i) => ({
          po_id: (po as any).id,
          description: i.description, quantity: i.quantity, unit_price: i.unit_price, account_code: i.account_code,
        }))
      );
    }
    await supabase.from('finance_purchase_requisitions' as any).update({ status: 'ordered' }).eq('id', pr.id);
    load();
  };

  const runMatch = async (po: any) => {
    const { data: receipts } = await supabase.from('finance_goods_receipts' as any)
      .select('quantity, po_item_id').eq('po_id', po.id);
    const { data: items } = await supabase.from('finance_purchase_order_items' as any)
      .select('id, unit_price').eq('po_id', po.id);
    let received_amount = 0;
    for (const r of (receipts ?? []) as any[]) {
      const it = (items ?? []).find((x: any) => x.id === r.po_item_id);
      received_amount += Number(r.quantity ?? 0) * Number(it?.unit_price ?? 0);
    }
    const { error } = await supabase.from('finance_three_way_matches' as any).insert({
      po_id: po.id,
      match_status: received_amount >= po.total_amount ? 'matched' : 'variance',
      po_amount: po.total_amount,
      received_amount,
      invoiced_amount: 0,
      currency: po.currency,
      matched_at: new Date().toISOString(),
    });
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { toast({ title: '3-Way-Match erzeugt' }); load(); }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6 container mx-auto px-4 py-8">
      <PageHeader
        title="Procure-to-Pay"
        subtitle={`${prs.length} Anforderungen · ${pos.length} Bestellungen · ${matches.length} Matches`}
        icon={ShoppingCart}
      />

      <Tabs defaultValue="prs">
        <TabsList>
          <TabsTrigger value="prs">Anforderungen</TabsTrigger>
          <TabsTrigger value="pos">Bestellungen</TabsTrigger>
          <TabsTrigger value="grs">Wareneingänge</TabsTrigger>
          <TabsTrigger value="match">3-Way-Match</TabsTrigger>
        </TabsList>

        <TabsContent value="prs" className="space-y-4">
          <DataCard title="Neue Anforderung">
            <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
              <Input placeholder="Beschreibung" value={newPr.description}
                onChange={(e) => setNewPr({ ...newPr, description: e.target.value })} />
              <Input type="number" placeholder="Menge" value={newPr.quantity}
                onChange={(e) => setNewPr({ ...newPr, quantity: e.target.value })} />
              <Input type="number" placeholder="Stückpreis" value={newPr.unit_price}
                onChange={(e) => setNewPr({ ...newPr, unit_price: e.target.value })} />
              <Input type="date" value={newPr.needed_by}
                onChange={(e) => setNewPr({ ...newPr, needed_by: e.target.value })} />
              <Button onClick={createPr}><Plus className="w-4 h-4 mr-1.5" />Anlegen</Button>
            </div>
          </DataCard>

          {prs.length === 0 ? <PageEmpty message="Keine Anforderungen." /> : (
            <DataCard title={`${prs.length} Bestellanforderungen`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">PR-Nr.</th>
                      <th className="text-left p-3">Notiz</th>
                      <th className="text-right p-3">Summe</th>
                      <th className="text-left p-3">Benötigt</th>
                      <th className="text-center p-3">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prs.map((pr) => (
                      <tr key={pr.id} className="border-b border-border/20">
                        <td className="p-3 font-mono text-xs">{pr.requisition_number}</td>
                        <td className="p-3 text-muted-foreground">{pr.notes}</td>
                        <td className="p-3 text-right">{fmt(pr.total_amount, pr.currency)}</td>
                        <td className="p-3">{pr.needed_by ?? '–'}</td>
                        <td className="p-3 text-center"><Badge variant="outline">{pr.status}</Badge></td>
                        <td className="p-3 text-right">
                          {pr.status === 'draft' && (
                            <Button size="sm" variant="outline" onClick={() => approvePr(pr.id)}>Genehmigen</Button>
                          )}
                          {pr.status === 'approved' && (
                            <Button size="sm" onClick={() => convertToPo(pr)}>In Bestellung umwandeln</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataCard>
          )}
        </TabsContent>

        <TabsContent value="pos" className="space-y-4">
          {pos.length === 0 ? <PageEmpty message="Keine Bestellungen." /> : (
            <DataCard title={`${pos.length} Bestellungen`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">PO-Nr.</th>
                      <th className="text-left p-3">Bestelldatum</th>
                      <th className="text-left p-3">Lieferung</th>
                      <th className="text-right p-3">Summe</th>
                      <th className="text-center p-3">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pos.map((p) => (
                      <tr key={p.id} className="border-b border-border/20">
                        <td className="p-3 font-mono text-xs">{p.po_number}</td>
                        <td className="p-3">{p.ordered_at}</td>
                        <td className="p-3">{p.expected_delivery ?? '–'}</td>
                        <td className="p-3 text-right">{fmt(p.total_amount, p.currency)}</td>
                        <td className="p-3 text-center"><Badge variant="outline">{p.status}</Badge></td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => runMatch(p)}>3-Way-Match</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataCard>
          )}
        </TabsContent>

        <TabsContent value="grs">
          {grs.length === 0 ? <PageEmpty message="Keine Wareneingänge." /> : (
            <DataCard title={`${grs.length} Wareneingänge`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Datum</th>
                      <th className="text-left p-3">PO</th>
                      <th className="text-right p-3">Menge</th>
                      <th className="text-left p-3">Notiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grs.map((g) => {
                      const po = pos.find((p) => p.id === g.po_id);
                      return (
                        <tr key={g.id} className="border-b border-border/20">
                          <td className="p-3">{g.received_at}</td>
                          <td className="p-3 font-mono text-xs">{po?.po_number ?? '–'}</td>
                          <td className="p-3 text-right">{Number(g.quantity).toLocaleString('de-DE')}</td>
                          <td className="p-3 text-muted-foreground">{g.notes ?? '–'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DataCard>
          )}
        </TabsContent>

        <TabsContent value="match">
          {matches.length === 0 ? <PageEmpty message="Noch keine Matches durchgeführt." /> : (
            <DataCard title={`${matches.length} 3-Way-Matches`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40 text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">PO</th>
                      <th className="text-right p-3">Bestellt</th>
                      <th className="text-right p-3">Erhalten</th>
                      <th className="text-right p-3">Berechnet</th>
                      <th className="text-right p-3">Abweichung</th>
                      <th className="text-center p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m) => {
                      const po = pos.find((p) => p.id === m.po_id);
                      return (
                        <tr key={m.id} className="border-b border-border/20">
                          <td className="p-3 font-mono text-xs">{po?.po_number ?? '–'}</td>
                          <td className="p-3 text-right">{fmt(m.po_amount, m.currency)}</td>
                          <td className="p-3 text-right">{fmt(m.received_amount, m.currency)}</td>
                          <td className="p-3 text-right">{fmt(m.invoiced_amount, m.currency)}</td>
                          <td className={`p-3 text-right ${Number(m.variance_amount) === 0 ? '' : 'text-amber-500'}`}>
                            {fmt(m.variance_amount, m.currency)}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant={m.match_status === 'matched' ? 'default' : 'outline'}>{m.match_status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DataCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
