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
import { notifyNewRepairOrder } from '@/lib/repair/notify';
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

  const [form, setForm] = useState<any>({
    customer_name: '',
    customer_company: '',
    customer_contact: '',
    customer_email: '',
    customer_phone: '',
    address_street: '',
    address_zip: '',
    address_city: '',
    address_country: '',
    priority: 'normal',
    device_type: '',
    device_category: '',
    device_brand: '',
    device_model: '',
    device_serial_number: '',
    purchase_date: '',
    accessories: '',
    issue_description: '',
    customer_error_description: '',
    visible_damages: '',
    powers_on: null as boolean | null,
    error_permanent: null as boolean | null,
    internal_notes: '',
  });

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));


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
      purchase_date: form.purchase_date || null,
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
        <Field label="Kunde / Firma *"><Input value={form.customer_name} onChange={(e) => upd('customer_name', e.target.value)} /></Field>
        <Field label="Firma (optional)"><Input value={form.customer_company} onChange={(e) => upd('customer_company', e.target.value)} /></Field>
        <Field label="Ansprechpartner"><Input value={form.customer_contact} onChange={(e) => upd('customer_contact', e.target.value)} /></Field>
        <Field label="E-Mail"><Input value={form.customer_email} onChange={(e) => upd('customer_email', e.target.value)} /></Field>
        <Field label="Telefon"><Input value={form.customer_phone} onChange={(e) => upd('customer_phone', e.target.value)} /></Field>
        <Field label="Priorität">
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.priority} onChange={(e) => upd('priority', e.target.value)}>
            <option value="niedrig">Niedrig</option>
            <option value="normal">Normal</option>
            <option value="hoch">Hoch</option>
            <option value="dringend">Dringend</option>
          </select>
        </Field>
        <Field label="Straße / Nr." className="md:col-span-2"><Input value={form.address_street} onChange={(e) => upd('address_street', e.target.value)} /></Field>
        <Field label="PLZ"><Input value={form.address_zip} onChange={(e) => upd('address_zip', e.target.value)} /></Field>
        <Field label="Ort"><Input value={form.address_city} onChange={(e) => upd('address_city', e.target.value)} /></Field>
        <Field label="Land"><Input value={form.address_country} onChange={(e) => upd('address_country', e.target.value)} placeholder="DE / AT / CH" /></Field>
        <div />
        <Field label="Gerätetyp"><Input value={form.device_type} onChange={(e) => upd('device_type', e.target.value)} placeholder="z. B. Diodenlaser" /></Field>
        <Field label="Gerätekategorie"><Input value={form.device_category} onChange={(e) => upd('device_category', e.target.value)} placeholder="z. B. Lasergerät" /></Field>
        <Field label="Seriennummer"><Input value={form.device_serial_number} onChange={(e) => upd('device_serial_number', e.target.value)} /></Field>
        <Field label="Marke"><Input value={form.device_brand} onChange={(e) => upd('device_brand', e.target.value)} /></Field>
        <Field label="Modell"><Input value={form.device_model} onChange={(e) => upd('device_model', e.target.value)} /></Field>
        <Field label="Kaufdatum"><Input type="date" value={form.purchase_date} onChange={(e) => upd('purchase_date', e.target.value)} /></Field>
        <Field label="Zubehör mitgegeben" className="md:col-span-3"><Input value={form.accessories} onChange={(e) => upd('accessories', e.target.value)} /></Field>
        <Field label="Sichtbare Schäden" className="md:col-span-3"><Textarea rows={2} value={form.visible_damages} onChange={(e) => upd('visible_damages', e.target.value)} /></Field>
        <Field label="Fehlerbeschreibung Kunde *" className="md:col-span-3"><Textarea rows={3} value={form.customer_error_description || form.issue_description} onChange={(e) => { upd('customer_error_description', e.target.value); upd('issue_description', e.target.value); }} /></Field>
        <Field label="Gerät schaltet ein?">
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.powers_on === null ? '' : String(form.powers_on)} onChange={(e) => upd('powers_on', e.target.value === '' ? null : e.target.value === 'true')}>
            <option value="">– unbekannt –</option>
            <option value="true">Ja</option>
            <option value="false">Nein</option>
          </select>
        </Field>
        <Field label="Fehler permanent?">
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.error_permanent === null ? '' : String(form.error_permanent)} onChange={(e) => upd('error_permanent', e.target.value === '' ? null : e.target.value === 'true')}>
            <option value="">– unbekannt –</option>
            <option value="true">Ja, dauerhaft</option>
            <option value="false">Sporadisch</option>
          </select>
        </Field>
        <div />
        <Field label="Interne Notizen" className="md:col-span-3"><Textarea rows={2} value={form.internal_notes} onChange={(e) => upd('internal_notes', e.target.value)} /></Field>
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
