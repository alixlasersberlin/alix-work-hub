import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { VipBadge } from '@/components/VipBadge';

interface Props {
  customer: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function CustomerEditDialog({ customer, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    company_name: customer?.company_name || '',
    contact_name: customer?.contact_name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    billing_street: customer?.billing_address?.address || customer?.billing_address?.street || '',
    billing_zip: customer?.billing_address?.zip || '',
    billing_city: customer?.billing_address?.city || '',
    billing_country: customer?.billing_address?.country || '',
    shipping_street: customer?.shipping_address?.address || customer?.shipping_address?.street || '',
    shipping_zip: customer?.shipping_address?.zip || '',
    shipping_city: customer?.shipping_address?.city || '',
    shipping_country: customer?.shipping_address?.country || '',
    iban: customer?.iban || '',
    bic: customer?.bic || '',
    bank_name: customer?.bank_name || '',
    is_vip: !!customer?.is_vip,
  });
  const [saving, setSaving] = useState(false);

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
    const { error } = await supabase.from('customers').update({
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
      iban: form.iban || null,
      bic: form.bic || null,
      bank_name: form.bank_name || null,
      is_vip: form.is_vip,
    } as any).eq('id', customer.id);
    setSaving(false);
    if (error) { toast.error('Fehler beim Speichern: ' + error.message); return; }
    toast.success('Kundendaten aktualisiert');
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
          <DialogTitle className="font-display">Kunde bearbeiten</DialogTitle>
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
          </div>

          <h3 className="text-sm font-medium text-foreground pt-2">Rechnungsadresse</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Straße" field="billing_street" /></div>
            <Field label="PLZ" field="billing_zip" />
            <Field label="Stadt" field="billing_city" />
            <Field label="Land" field="billing_country" />
          </div>

          <h3 className="text-sm font-medium text-foreground pt-2">Bankdaten</h3>
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
