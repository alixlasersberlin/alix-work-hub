import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { VipBadge } from '@/components/VipBadge';
import { ensureCaseNumber, nextNumber } from '@/lib/number-ranges';
import { useAuth } from '@/hooks/useAuth';


interface Props {
  customer: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function CustomerEditDialog({ customer, open, onClose, onSaved }: Props) {
  const { hasRole, isAdmin } = useAuth();
  const canEditBank = isAdmin || hasRole('Finance') || hasRole('Finanzierungen');
  const c = customer || {};
  const ba = (c as any).billing_address || {};
  const sa = (c as any).shipping_address || {};
  const [form, setForm] = useState({
    company_name: c.company_name ?? '',
    contact_name: c.contact_name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    birth_date: c.birth_date ?? '',
    billing_street: ba.address ?? ba.street ?? '',
    billing_zip: ba.zip ?? '',
    billing_city: ba.city ?? '',
    billing_country: ba.country ?? '',
    shipping_street: sa.address ?? sa.street ?? '',
    shipping_zip: sa.zip ?? '',
    shipping_city: sa.city ?? '',
    shipping_country: sa.country ?? '',
    iban: c.iban ?? '',
    bic: c.bic ?? '',
    bank_name: c.bank_name ?? '',
    is_vip: !!c.is_vip,
    contact_tenant_id: c.contact_tenant_id ?? '',
    supplier_tenant_id: c.supplier_tenant_id ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; flag_emoji: string | null; code: string }>>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tenants')
        .select('id, name, flag_emoji, code')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setTenants(data || []);
    })();
  }, []);

  // Bank-Daten separat aus `customer_bank_details` laden (Finance-only via RLS).
  useEffect(() => {
    if (!customer?.id || !canEditBank) return;
    (async () => {
      const { data } = await supabase
        .from('customer_bank_details')
        .select('iban, bic, bank_name')
        .eq('customer_id', customer.id)
        .maybeSingle();
      if (data) {
        setForm(f => ({
          ...f,
          iban: (data as any).iban || '',
          bic: (data as any).bic || '',
          bank_name: (data as any).bank_name || '',
        }));
      }
    })();
  }, [customer?.id, canEditBank]);


  // Auto-detect bank from IBAN
  function handleIbanChange(val: string) {
    set('iban', val);
    const clean = val.replace(/\s/g, '').toUpperCase();
    if (clean.length >= 8) {
      const bankCode = clean.substring(4, 12);
      const knownBanks: Record<string, string> = {
        '10010010': 'Postbank',
        '10020500': 'Bank für Sozialwirtschaft',
        '10050000': 'Landesbank Berlin',
        '10070000': 'Deutsche Bank Berlin',
        '10070024': 'Deutsche Bank',
        '10090000': 'Berliner Volksbank',
        '20010020': 'Postbank Hamburg',
        '25050000': 'Nord/LB',
        '30010111': 'SEB AG',
        '37010050': 'Postbank Köln',
        '37040044': 'Commerzbank',
        '43060967': 'GLS Bank',
        '50010060': 'Postbank Frankfurt',
        '50010517': 'ING-DiBa',
        '50020200': 'HBCE Bank',
        '50040000': 'Commerzbank',
        '50070010': 'Deutsche Bank',
        '50070024': 'Deutsche Bank',
        '50090500': 'Sparda-Bank Hessen',
        '60020290': 'UniCredit HypoVereinsbank',
        '70010080': 'Postbank München',
        '70020270': 'UniCredit HypoVereinsbank',
        '76010085': 'Postbank Nürnberg',
        'COBADEFF': 'Commerzbank',
      };
      const found = knownBanks[bankCode];
      if (found) set('bank_name', found);
    }
  }

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  async function handleSave() {
    setSaving(true);
    const payload: any = {
      company_name: form.company_name || null,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      billing_address: {
        address: form.billing_street,
        zip: form.billing_zip,
        city: form.billing_city,
        country: form.billing_country,
      },
      shipping_address: {
        address: form.shipping_street,
        zip: form.shipping_zip,
        city: form.shipping_city,
        country: form.shipping_country,
      },
      birth_date: form.birth_date || null,
      is_vip: form.is_vip,
      contact_tenant_id: form.contact_tenant_id || null,
      supplier_tenant_id: form.supplier_tenant_id || null,
    };
    const isNew = !customer?.id;
    if (isNew) {
      payload.source_system = 'manual';
      // Kundennummer aus dem Nummernkreis „customer" ziehen. Der Kreis erbt
      // die Vorgangs-Stammnummer, sodass Kunde/Angebot/Auftrag/Rechnung
      // dieselbe Basisnummer teilen und sich nur der Prefix unterscheidet.
      const cn = await ensureCaseNumber(null);
      payload.external_customer_id = await nextNumber(
        'customer',
        () => `manual-${crypto.randomUUID()}`,
        { caseNumber: cn },
      );
    }
    const saveRes = isNew
      ? await supabase.from('customers').insert(payload).select('id').maybeSingle()
      : await supabase.from('customers').update(payload).eq('id', customer.id).select('id').maybeSingle();
    if (saveRes.error) { setSaving(false); toast.error('Fehler beim Speichern: ' + saveRes.error.message); return; }
    const savedId = (saveRes.data as any)?.id ?? customer?.id;

    // Bank-Daten sind Finance-only und liegen in einer separaten Tabelle.
    if (canEditBank && savedId) {
      const bankPayload = {
        customer_id: savedId,
        iban: form.iban || null,
        bic: form.bic || null,
        bank_name: form.bank_name || null,
      };
      const { error: bErr } = await supabase
        .from('customer_bank_details')
        .upsert(bankPayload, { onConflict: 'customer_id' });
      if (bErr) { setSaving(false); toast.error('Bankdaten konnten nicht gespeichert werden: ' + bErr.message); return; }
    }

    setSaving(false);
    toast.success(isNew ? 'Kunde angelegt' : 'Kundendaten aktualisiert');
    onSaved();
    onClose();
  }



  const Field = ({ label, field }: { label: string; field: string }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={(form as any)[field]}
        onChange={e => set(field, e.target.value)}
        className="bg-secondary border-border mt-1"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{customer?.id ? 'Kunde bearbeiten' : 'Neuen Kunden anlegen'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-3 cursor-pointer">
            <span className="flex items-center gap-2">
              <VipBadge size="md" />
              <span className="text-sm font-medium">VIP-Kunde – bevorzugte Behandlung, Position 1 in allen Listen</span>
            </span>
            <Checkbox checked={form.is_vip} onCheckedChange={v => setForm(f => ({ ...f, is_vip: !!v }))} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Firmenname" field="company_name" />
            <Field label="Kontaktperson" field="contact_name" />
            <Field label="E-Mail" field="email" />
            <Field label="Telefon" field="phone" />
            <div>
              <Label className="text-xs text-muted-foreground">Geburtsdatum</Label>
              <Input
                type="date"
                value={form.birth_date}
                onChange={e => set('birth_date', e.target.value)}
                className="bg-secondary border-border mt-1"
              />
            </div>
          </div>

          <h3 className="text-sm font-medium text-foreground pt-2">Mandanten-Zuordnung</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Ansprechpartner-Mandant</Label>
              <Select
                value={form.contact_tenant_id || '__none__'}
                onValueChange={v => set('contact_tenant_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="bg-secondary border-border mt-1">
                  <SelectValue placeholder="Mandant wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nicht zugewiesen —</SelectItem>
                  {tenants.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.flag_emoji ? `${t.flag_emoji} ` : ''}{t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Lieferer-Mandant</Label>
              <Select
                value={form.supplier_tenant_id || '__none__'}
                onValueChange={v => set('supplier_tenant_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="bg-secondary border-border mt-1">
                  <SelectValue placeholder="Mandant wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nicht zugewiesen —</SelectItem>
                  {tenants.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.flag_emoji ? `${t.flag_emoji} ` : ''}{t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>




          <h3 className="text-sm font-medium text-foreground pt-2">Rechnungsadresse</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Straße" field="billing_street" /></div>
            <Field label="PLZ" field="billing_zip" />
            <Field label="Stadt" field="billing_city" />
            <Field label="Land" field="billing_country" />
          </div>

          {canEditBank && (
            <>
              <h3 className="text-sm font-medium text-foreground pt-2">Bankdaten <span className="text-xs text-muted-foreground font-normal">(nur Finance)</span></h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">IBAN</Label>
                  <Input
                    value={form.iban}
                    onChange={e => handleIbanChange(e.target.value)}
                    className="bg-secondary border-border mt-1"
                    placeholder="DE89 3704 0044 0532 0130 00"
                  />
                </div>
                <Field label="BIC" field="bic" />
                <Field label="Bank" field="bank_name" />
              </div>
            </>
          )}


          <h3 className="text-sm font-medium text-foreground pt-2">Lieferadresse</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Straße" field="shipping_street" /></div>
            <Field label="PLZ" field="shipping_zip" />
            <Field label="Stadt" field="shipping_city" />
            <Field label="Land" field="shipping_country" />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving} className="gold-gradient text-primary-foreground">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
