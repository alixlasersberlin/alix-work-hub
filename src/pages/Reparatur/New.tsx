import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { REPAIR_PRIORITIES } from '@/lib/repair/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';

type OrderSearchRow = {
  id: string;
  order_number: string;
  customer_id: string;
  customers?: { company_name: string | null; contact_name: string | null; email: string | null; phone: string | null; billing_address: any };
};

export default function ReparaturNew() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [saving, setSaving] = useState(false);

  // Option A
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrderSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderSearchRow | null>(null);

  // Form fields (shared)
  const [form, setForm] = useState({
    customer_company: '',
    customer_contact: '',
    customer_email: '',
    customer_phone: '',
    customer_street: '',
    customer_zip: '',
    customer_city: '',
    device_type: '',
    serial_number: '',
    purchase_date: '',
    accessories: '',
    customer_error_description: '',
    visible_damages: '',
    powers_on: true,
    error_permanent: true,
    priority: 'Normal' as (typeof REPAIR_PRIORITIES)[number],
  });

  const upd = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const q = searchQuery.trim();
    // Search orders by order_number
    const { data: byOrder } = await supabase
      .from('orders')
      .select('id,order_number,customer_id,customers:customer_id(company_name,contact_name,email,phone,billing_address)')
      .or(`order_number.ilike.%${q}%,external_order_id.ilike.%${q}%`)
      .limit(20);
    // Search customers, then their orders
    const { data: byCust } = await supabase
      .from('customers')
      .select('id,company_name,contact_name,email,phone,billing_address')
      .or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(20);
    let custOrders: any[] = [];
    if (byCust && byCust.length > 0) {
      const ids = byCust.map((c: any) => c.id);
      const { data: ord } = await supabase
        .from('orders')
        .select('id,order_number,customer_id,customers:customer_id(company_name,contact_name,email,phone,billing_address)')
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
    const addr = (c?.billing_address || {}) as any;
    upd('customer_company', c?.company_name || '');
    upd('customer_contact', c?.contact_name || '');
    upd('customer_email', c?.email || '');
    upd('customer_phone', c?.phone || '');
    upd('customer_street', addr.street || addr.address || '');
    upd('customer_zip', addr.zip || addr.postal_code || '');
    upd('customer_city', addr.city || '');
  };

  const submit = async () => {
    if (!form.customer_company && !form.customer_contact) {
      toast({ title: 'Pflichtfeld fehlt', description: 'Kunde / Firma oder Ansprechpartner erforderlich', variant: 'destructive' });
      return;
    }
    if (!form.device_type) {
      toast({ title: 'Pflichtfeld fehlt', description: 'Gerätetyp erforderlich', variant: 'destructive' });
      return;
    }
    if (!form.customer_error_description) {
      toast({ title: 'Pflichtfeld fehlt', description: 'Fehlerbeschreibung erforderlich', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      ...form,
      purchase_date: form.purchase_date || null,
      source: mode === 'existing' ? 'existing_order' : 'new_customer',
      order_id: selectedOrder?.id || null,
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
              placeholder="Auftragsnr., Kunde, Firma, PLZ, Telefon, E-Mail, Seriennr., Gerätetyp"
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
        <Field label="Kunde / Firma *"><Input value={form.customer_company} onChange={(e) => upd('customer_company', e.target.value)} /></Field>
        <Field label="Ansprechpartner"><Input value={form.customer_contact} onChange={(e) => upd('customer_contact', e.target.value)} /></Field>
        <Field label="E-Mail"><Input value={form.customer_email} onChange={(e) => upd('customer_email', e.target.value)} /></Field>
        <Field label="Telefon"><Input value={form.customer_phone} onChange={(e) => upd('customer_phone', e.target.value)} /></Field>
        <Field label="Straße"><Input value={form.customer_street} onChange={(e) => upd('customer_street', e.target.value)} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="PLZ"><Input value={form.customer_zip} onChange={(e) => upd('customer_zip', e.target.value)} /></Field>
          <Field label="Ort" className="col-span-2"><Input value={form.customer_city} onChange={(e) => upd('customer_city', e.target.value)} /></Field>
        </div>
        <Field label="Gerätetyp *"><Input value={form.device_type} onChange={(e) => upd('device_type', e.target.value)} /></Field>
        <Field label="Seriennummer"><Input value={form.serial_number} onChange={(e) => upd('serial_number', e.target.value)} /></Field>
        <Field label="Kaufdatum"><Input type="date" value={form.purchase_date} onChange={(e) => upd('purchase_date', e.target.value)} /></Field>
        <Field label="Zubehör mitgegeben"><Input value={form.accessories} onChange={(e) => upd('accessories', e.target.value)} /></Field>
        <Field label="Fehlerbeschreibung Kunde *" className="md:col-span-2"><Textarea rows={3} value={form.customer_error_description} onChange={(e) => upd('customer_error_description', e.target.value)} /></Field>
        <Field label="Sichtbare Beschädigungen" className="md:col-span-2"><Textarea rows={2} value={form.visible_damages} onChange={(e) => upd('visible_damages', e.target.value)} /></Field>
        <Field label="Gerät lässt sich einschalten">
          <div className="flex items-center gap-2 h-10"><Switch checked={form.powers_on} onCheckedChange={(v) => upd('powers_on', v)} /><span className="text-sm text-muted-foreground">{form.powers_on ? 'Ja' : 'Nein'}</span></div>
        </Field>
        <Field label="Fehler tritt dauerhaft auf">
          <div className="flex items-center gap-2 h-10"><Switch checked={form.error_permanent} onCheckedChange={(v) => upd('error_permanent', v)} /><span className="text-sm text-muted-foreground">{form.error_permanent ? 'Ja' : 'Nein'}</span></div>
        </Field>
        <Field label="Priorität">
          <Select value={form.priority} onValueChange={(v) => upd('priority', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REPAIR_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
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
