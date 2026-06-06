import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { sendCustomerShippingNotice } from '@/lib/send-customer-shipping-notice';
import { sendReviewInvitation } from '@/lib/review-invitation';
import { VipBadge } from '@/components/VipBadge';

const STATUS_OPTIONS = [
  'offen', 'bestätigt', 'in Bearbeitung', 'versendet', 'teilgeliefert', 'geliefert',
  'abgeschlossen', 'storniert', 'zurückgestellt', 'Hold', 'Anwalt',
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
    deposit_ok: !!order?.deposit_ok,
    deposit_ok_by: order?.deposit_ok_by || '',
    is_vip: !!order?.is_vip,
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  async function handleSave() {
    const intNum = form.internal_number.trim();
    if (intNum && !/^[A-Za-z0-9]{1,10}$/.test(intNum)) {
      toast.error('Intern Nummer: max. 10 Zeichen, nur Buchstaben und Zahlen');
      return;
    }
    if (form.deposit_ok && !form.deposit_ok_by.trim()) {
      toast.error('Bitte Mitarbeitername für "ANZAHLUNG OK" eintragen');
      return;
    }
    setSaving(true);
    const depositChanged = !!order?.deposit_ok !== form.deposit_ok || (order?.deposit_ok_by || '') !== form.deposit_ok_by.trim();
    const willBecomeDelivered = form.order_status === 'geliefert' && order?.order_status !== 'geliefert';
    // Reservierte Geräte VOR dem Status-Update einlesen — der DB-Trigger
    // clear_lager_reservation_on_delivery setzt reserved_order_id=NULL bei "geliefert".
    let prefetchedDevices: Array<{ model_name: string | null; serial_number: string | null }> = [];
    if (willBecomeDelivered) {
      const { data: devs } = await supabase
        .from('lager_devices')
        .select('model_name, serial_number')
        .eq('reserved_order_id', order.id);
      prefetchedDevices = devs || [];
    }
    const { error } = await supabase.from('orders').update({
      order_status: form.order_status,
      total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
      currency: form.currency || null,
      salesperson_name: form.salesperson_name || null,
      expected_shipment_date: form.expected_shipment_date || null,
      internal_number: intNum || null,
      lawyer_reason: form.order_status === 'Anwalt' ? (form.lawyer_reason || null) : null,
      deposit_ok: form.deposit_ok,
      deposit_ok_by: form.deposit_ok ? form.deposit_ok_by.trim() : null,
      deposit_ok_at: form.deposit_ok ? (depositChanged ? new Date().toISOString() : order?.deposit_ok_at) : null,
      is_vip: form.is_vip,
    } as any).eq('id', order.id);
    setSaving(false);
    if (error) { toast.error('Fehler beim Speichern: ' + error.message); return; }
    toast.success('Auftrag aktualisiert');
    if (willBecomeDelivered) {
      const mail = await sendCustomerShippingNotice(order.id, undefined, 'automatisch', 'customer_delivered', prefetchedDevices);
      if (mail.ok) toast.success(mail.message); else toast.error('E-Mail nicht versendet: ' + mail.message);
      // Automatische Bewertungseinladung (fehlerresistent)
      sendReviewInvitation(order.id, { manual: false }).catch(() => {});
    }


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
          <label className="flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-3 cursor-pointer">
            <span className="flex items-center gap-2">
              <VipBadge size="md" />
              <span className="text-sm font-medium">VIP-Auftrag – Position 1 in allen Listen</span>
            </span>
            <Checkbox checked={form.is_vip} onCheckedChange={v => setForm(f => ({ ...f, is_vip: !!v }))} />
          </label>
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
          {form.order_status === 'Anwalt' && (
            <div>
              <Label className="text-xs text-muted-foreground">Anwalt-Grund</Label>
              <Select value={form.lawyer_reason} onValueChange={v => set('lawyer_reason', v)}>
                <SelectTrigger className="bg-secondary border-border mt-1">
                  <SelectValue placeholder="Grund auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {LAWYER_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
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
          <div className="rounded-md border border-border bg-secondary/50 p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={form.deposit_ok}
                onCheckedChange={v => setForm(f => ({ ...f, deposit_ok: !!v }))}
              />
              <span className="text-sm font-semibold tracking-wide">ANZAHLUNG OK</span>
            </label>
            {form.deposit_ok && (
              <div>
                <Label className="text-xs text-muted-foreground">Mitarbeiter (Name)</Label>
                <Input
                  value={form.deposit_ok_by}
                  onChange={e => set('deposit_ok_by', e.target.value)}
                  placeholder="Name des Mitarbeiters"
                  className="bg-background border-border mt-1"
                />
                {order?.deposit_ok_at && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Bestätigt am {new Date(order.deposit_ok_at).toLocaleString('de-DE')}
                  </p>
                )}
              </div>
            )}
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
