import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { User2, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string };

type CustomerData = {
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  external_customer_id: string | null;
  billing_address: any;
};

const FIELDS: Array<{ key: string; label: string }> = [
  { key: 'company_name', label: 'Firmenname' },
  { key: 'contact_name', label: 'Ansprechpartner' },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'billing_address.street', label: 'Straße' },
  { key: 'billing_address.zip', label: 'PLZ' },
  { key: 'billing_address.city', label: 'Ort' },
  { key: 'billing_address.country', label: 'Land' },
];

export default function CustomerPortalMyData() {
  const ctx = useOutletContext<Ctx>();
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      void logPortalAudit({ action: 'profile_opened', customerId: ctx.customerId });
      const { data } = await supabase
        .from('customers')
        .select('company_name, contact_name, email, phone, external_customer_id, billing_address')
        .eq('id', ctx.customerId)
        .maybeSingle();
      setData(data as CustomerData | null);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return <p className="text-center py-10 text-muted-foreground">Keine Stammdaten gefunden.</p>;

  const addr = (data.billing_address ?? {}) as any;

  const rows: Array<[string, string]> = [
    ['Kundennummer', data.external_customer_id ?? '—'],
    ['Firmenname', data.company_name ?? '—'],
    ['Ansprechpartner', data.contact_name ?? '—'],
    ['E-Mail', data.email ?? '—'],
    ['Telefon', data.phone ?? '—'],
    ['Straße', addr.street ?? addr.address ?? '—'],
    ['PLZ', addr.zip ?? addr.postal_code ?? '—'],
    ['Ort', addr.city ?? '—'],
    ['Land', addr.country ?? '—'],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><User2 className="w-5 h-5" /> Meine Daten</CardTitle>
          <ChangeRequestDialog customerId={ctx.customerId} rows={rows} />
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-1 md:grid-cols-3 gap-2 py-3">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
                <dd className="md:col-span-2 text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground mt-4">
            Änderungen an Ihren Stammdaten nehmen wir aus Sicherheitsgründen manuell vor.
            Bitte nutzen Sie „Datenänderung mitteilen".
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ChangeRequestDialog({ customerId, rows }: { customerId: string; rows: Array<[string, string]> }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState(rows[0]?.[0] ?? '');
  const [current, setCurrent] = useState(rows[0]?.[1] ?? '');
  const [wanted, setWanted] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!wanted.trim()) {
      toast.error('Bitte gewünschten neuen Wert eintragen.');
      return;
    }
    setBusy(true);
    const subject = `Datenänderung: ${field}`;
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('customer_portal_tickets').insert({
      customer_id: customerId,
      subject,
      category: 'data_change_request',
      status: 'offen',
      priority: 'normal',
      created_by: user.user?.id ?? null,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    void logPortalAudit({
      action: 'data_change_requested',
      customerId,
      metadata: { field, current, wanted, note },
    });
    setBusy(false);
    setOpen(false);
    setWanted('');
    setNote('');
    toast.success('Änderungsanfrage übermittelt. Wir melden uns bei Ihnen.');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="w-4 h-4 mr-2" /> Datenänderung mitteilen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Datenänderung mitteilen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Feld</Label>
            <Select value={field} onValueChange={(v) => { setField(v); setCurrent(rows.find((r) => r[0] === v)?.[1] ?? ''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rows.map(([label]) => <SelectItem key={label} value={label}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bisheriger Wert</Label>
            <Input value={current} disabled />
          </div>
          <div>
            <Label>Gewünschter neuer Wert</Label>
            <Input value={wanted} onChange={(e) => setWanted(e.target.value)} />
          </div>
          <div>
            <Label>Nachricht (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Anfrage senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
