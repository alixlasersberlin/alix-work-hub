import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const STATUS_OPTIONS = [
  'offen', 'bestätigt', 'in Bearbeitung', 'versendet', 'teilgeliefert', 'geliefert',
  'abgeschlossen', 'storniert', 'zurückgestellt', 'Anwalt',
];

const LAWYER_REASONS = ['Zahlungsverzug', 'Auftragserfüllung', 'Stornierung', 'Keine Anzahlung'];

interface Props {
  order: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function OrderEditDialog({ order, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    order_status: order?.order_status || 'offen',
    total_amount: order?.total_amount?.toString() || '',
    currency: order?.currency || 'EUR',
    salesperson_name: order?.salesperson_name || '',
    expected_shipment_date: order?.expected_shipment_date
      ? new Date(order.expected_shipment_date).toISOString().split('T')[0]
      : '',
    internal_number: order?.internal_number || '',
    lawyer_reason: order?.lawyer_reason || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  async function handleSave() {
    const intNum = form.internal_number.trim();
    if (intNum && !/^[A-Za-z0-9]{1,10}$/.test(intNum)) {
      toast.error('Intern Nummer: max. 10 Zeichen, nur Buchstaben und Zahlen');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('orders').update({
      order_status: form.order_status,
      total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
      currency: form.currency || null,
      salesperson_name: form.salesperson_name || null,
      expected_shipment_date: form.expected_shipment_date || null,
      internal_number: intNum || null,
      lawyer_reason: form.order_status === 'Anwalt' ? (form.lawyer_reason || null) : null,
    }).eq('id', order.id);
    setSaving(false);
    if (error) { toast.error('Fehler beim Speichern: ' + error.message); return; }
    toast.success('Auftrag aktualisiert');
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Auftrag bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={form.order_status} onValueChange={v => set('order_status', v)}>
              <SelectTrigger className="bg-secondary border-border mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Betrag</Label>
              <Input type="number" step="0.01" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} className="bg-secondary border-border mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Währung</Label>
              <Input value={form.currency} onChange={e => set('currency', e.target.value)} className="bg-secondary border-border mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Verkäufer</Label>
            <Input value={form.salesperson_name} onChange={e => set('salesperson_name', e.target.value)} className="bg-secondary border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Erw. Versanddatum</Label>
            <Input type="date" value={form.expected_shipment_date} onChange={e => set('expected_shipment_date', e.target.value)} className="bg-secondary border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Intern Nummer</Label>
            <Input
              value={form.internal_number}
              onChange={e => set('internal_number', e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10))}
              maxLength={10}
              placeholder="Max. 10 Zeichen (A-Z, 0-9)"
              className="bg-secondary border-border mt-1 font-mono uppercase"
            />
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
