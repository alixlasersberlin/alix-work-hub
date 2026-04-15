import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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
  });
  const [saving, setSaving] = useState(false);

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
    }).eq('id', customer.id);
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
