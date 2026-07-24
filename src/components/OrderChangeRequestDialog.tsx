import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

interface Props {
  order: any;
  open: boolean;
  onClose: () => void;
}

const STATUS = ['offen', 'in_bearbeitung', 'geliefert', 'teilgeliefert', 'storniert', 'abgeschlossen'];

export default function OrderChangeRequestDialog({ order, open, onClose }: Props) {
  const { user, profile } = useAuth();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [orderStatus, setOrderStatus] = useState<string>(order?.order_status ?? '');
  const [totalAmount, setTotalAmount] = useState<string>(String(order?.total_amount ?? ''));
  const [salesperson, setSalesperson] = useState<string>(order?.salesperson_name ?? '');
  const [internalNumber, setInternalNumber] = useState<string>(order?.internal_number ?? '');
  const [vatMode, setVatMode] = useState<string>(order?.vat_display_mode ?? 'brutto');
  const [expectedShipment, setExpectedShipment] = useState<string>(
    order?.expected_shipment_date ? String(order.expected_shipment_date).slice(0, 10) : '',
  );
  const [billing, setBilling] = useState<string>(
    order?.billing_address ? JSON.stringify(order.billing_address, null, 2) : '',
  );
  const [shipping, setShipping] = useState<string>(
    order?.shipping_address ? JSON.stringify(order.shipping_address, null, 2) : '',
  );

  const proposedChanges = useMemo(() => {
    const c: Record<string, unknown> = {};
    if (orderStatus && orderStatus !== order?.order_status) c.order_status = orderStatus;
    if (totalAmount !== '' && Number(totalAmount) !== Number(order?.total_amount)) c.total_amount = Number(totalAmount);
    if (salesperson !== (order?.salesperson_name ?? '')) c.salesperson_name = salesperson;
    if (internalNumber !== (order?.internal_number ?? '')) c.internal_number = internalNumber;
    if (vatMode !== (order?.vat_display_mode ?? 'brutto')) c.vat_display_mode = vatMode;
    if (expectedShipment && expectedShipment !== String(order?.expected_shipment_date ?? '').slice(0, 10)) {
      c.expected_shipment_date = new Date(expectedShipment).toISOString();
    }
    try {
      const b = billing.trim() ? JSON.parse(billing) : null;
      if (JSON.stringify(b) !== JSON.stringify(order?.billing_address ?? null)) c.billing_address = b;
    } catch {}
    try {
      const s = shipping.trim() ? JSON.parse(shipping) : null;
      if (JSON.stringify(s) !== JSON.stringify(order?.shipping_address ?? null)) c.shipping_address = s;
    } catch {}
    return c;
  }, [orderStatus, totalAmount, salesperson, internalNumber, vatMode, expectedShipment, billing, shipping, order]);

  const submit = async () => {
    if (!user) { toast.error('Nicht angemeldet'); return; }
    if (Object.keys(proposedChanges).length === 0) { toast.error('Keine Änderungen erkannt'); return; }
    setSaving(true);
    const snapshot: Record<string, unknown> = {};
    for (const k of Object.keys(proposedChanges)) snapshot[k] = (order as any)?.[k] ?? null;

    const { error } = await supabase.from('order_change_requests').insert({
      order_id: order.id,
      order_number: order.order_number ?? null,
      requested_by: user.id,
      requested_by_name: (profile as any)?.full_name ?? user.email ?? null,
      reason: reason || null,
      proposed_changes: proposedChanges as any,
      original_snapshot: snapshot as any,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Änderungsanfrage gesendet – Super Admin wurde benachrichtigt.');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auftragsänderung vorschlagen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Deine Änderung wird gespeichert und zur Freigabe an einen Super Admin gesendet.
            Das Original bleibt bis zur Freigabe unverändert.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={orderStatus} onValueChange={setOrderStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Summe</Label>
              <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </div>
            <div>
              <Label>Verkäufer</Label>
              <Input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} />
            </div>
            <div>
              <Label>Interne Nr.</Label>
              <Input value={internalNumber} onChange={(e) => setInternalNumber(e.target.value)} />
            </div>
            <div>
              <Label>MwSt-Anzeige</Label>
              <Select value={vatMode} onValueChange={setVatMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brutto">brutto</SelectItem>
                  <SelectItem value="netto">netto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Voraussichtl. Versand</Label>
              <Input type="date" value={expectedShipment} onChange={(e) => setExpectedShipment(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Rechnungsadresse (JSON)</Label>
            <Textarea rows={4} value={billing} onChange={(e) => setBilling(e.target.value)} />
          </div>
          <div>
            <Label>Lieferadresse (JSON)</Label>
            <Textarea rows={4} value={shipping} onChange={(e) => setShipping(e.target.value)} />
          </div>
          <div>
            <Label>Begründung *</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Warum soll dieser Auftrag geändert werden?" />
          </div>

          <div className="text-xs text-muted-foreground">
            {Object.keys(proposedChanges).length} Feld(er) werden zur Freigabe gesendet.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving || !reason.trim() || Object.keys(proposedChanges).length === 0}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Zur Freigabe senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
