import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';

type OrderSearchRow = {
  id: string;
  order_number: string;
  customer_id: string;
  customers?: { company_name: string | null; contact_name: string | null; email: string | null; phone: string | null };
};

export default function ReparaturNew() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrderSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderSearchRow | null>(null);

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    device_category: '',
    device_brand: '',
    device_model: '',
    device_serial_number: '',
    accessories: '',
    issue_description: '',
    internal_notes: '',
  });

  const upd = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const q = searchQuery.trim();
    const { data: byOrder } = await supabase
      .from('orders')
      .select('id,order_number,customer_id,customers:customer_id(company_name,contact_name,email,phone)')
      .or(`order_number.ilike.%${q}%,external_order_id.ilike.%${q}%`)
      .limit(20);
    const { data: byCust } = await supabase
      .from('customers')
      .select('id,company_name,contact_name,email,phone')
      .or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(20);
    let custOrders: any[] = [];
    if (byCust && byCust.length > 0) {
      const ids = byCust.map((c: any) => c.id);
      const { data: ord } = await supabase
        .from('orders')
        .select('id,order_number,customer_id,customers:customer_id(company_name,contact_name,email,phone)')
        .in('customer_id', ids)
        .limit(50);
      custOrders = ord || [];
    }
    const map = new Map<string, OrderSearchRow>();
    [...(byOrder || []), ...custOrders].forEach((o: any) => map.set(o.id, o));
    setSearchResults(Array.from(map.values()));
    setSearching(false);
  };

  const pickOrder = (o: OrderSearchRow) => {
    setSelectedOrder(o);
    const c = o.customers as any;
    upd('customer_name', c?.company_name || c?.contact_name || '');
    upd('customer_email', c?.email || '');
    upd('customer_phone', c?.phone || '');
  };

  const submit = async () => {
    if (!form.customer_name) {
      toast({ title: 'Pflichtfeld fehlt', description: 'Kunde / Firma erforderlich', variant: 'destructive' });
      return;
    }
    if (!form.device_category && !form.device_brand && !form.device_model) {
      toast({ title: 'Pflichtfeld fehlt', description: 'Mindestens ein Gerätefeld erforderlich', variant: 'destructive' });
      return;
    }
    if (!form.issue_description) {
      toast({ title: 'Pflichtfeld fehlt', description: 'Fehlerbeschreibung erforderlich', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      ...form,
      repair_status: 'Neu',
      order_id: selectedOrder?.id || null,
      order_number: selectedOrder?.order_number || null,
      customer_id: selectedOrder?.customer_id || null,
      created_by: user?.id,
      updated_by: user?.id,
    };
    const { data, error } = await sbRepair.from('repair_orders').insert(payload).select('id,repair_number').single();
    setSaving(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Reparatur angelegt', description: data.repair_number });
    nav(`/reparatur/${data.id}`);
  };

  return (
    <Card className="p-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
        <TabsList>
          <TabsTrigger value="existing">Option A · Bestehender Auftrag</TabsTrigger>
          <TabsTrigger value="new">Option B · Neukunde</TabsTrigger>
        </TabsList>

        <TabsContent value="existing" className="space-y-3 pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Auftragsnr., Kunde, Firma, Telefon, E-Mail"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
            <Button onClick={runSearch} disabled={searching}><Search className="w-4 h-4 mr-1" /> Suchen</Button>
          </div>
          {searchResults.length > 0 && (
            <Card className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {searchResults.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => pickOrder(o)}
                      className={`border-b border-border cursor-pointer hover:bg-muted/40 ${selectedOrder?.id === o.id ? 'bg-primary/10' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono">{o.order_number}</td>
                      <td className="px-3 py-2">{(o.customers as any)?.company_name || (o.customers as any)?.contact_name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{(o.customers as any)?.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="new" className="pt-4">
          <p className="text-xs text-muted-foreground">Direkt unten Felder ausfüllen — Kundendaten werden mit der Reparatur gespeichert.</p>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
        <Field label="Kunde / Firma *"><Input value={form.customer_name} onChange={(e) => upd('customer_name', e.target.value)} /></Field>
        <Field label="E-Mail"><Input value={form.customer_email} onChange={(e) => upd('customer_email', e.target.value)} /></Field>
        <Field label="Telefon"><Input value={form.customer_phone} onChange={(e) => upd('customer_phone', e.target.value)} /></Field>
        <Field label="Gerätekategorie"><Input value={form.device_category} onChange={(e) => upd('device_category', e.target.value)} placeholder="z. B. Lasergerät, Handstück" /></Field>
        <Field label="Marke"><Input value={form.device_brand} onChange={(e) => upd('device_brand', e.target.value)} /></Field>
        <Field label="Modell"><Input value={form.device_model} onChange={(e) => upd('device_model', e.target.value)} /></Field>
        <Field label="Seriennummer"><Input value={form.device_serial_number} onChange={(e) => upd('device_serial_number', e.target.value)} /></Field>
        <Field label="Zubehör mitgegeben"><Input value={form.accessories} onChange={(e) => upd('accessories', e.target.value)} /></Field>
        <Field label="Fehlerbeschreibung Kunde *" className="md:col-span-2"><Textarea rows={3} value={form.issue_description} onChange={(e) => upd('issue_description', e.target.value)} /></Field>
        <Field label="Interne Notizen" className="md:col-span-2"><Textarea rows={2} value={form.internal_notes} onChange={(e) => upd('internal_notes', e.target.value)} /></Field>
      </div>

      <div className="flex justify-end gap-2 pt-6">
        <Button variant="outline" onClick={() => nav('/reparatur/auftraege')}>Abbrechen</Button>
        <Button onClick={submit} disabled={saving}>{saving ? 'Speichere…' : 'Reparatur anlegen'}</Button>
      </div>
    </Card>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
