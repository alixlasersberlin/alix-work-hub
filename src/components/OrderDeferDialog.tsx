import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CalendarClock } from 'lucide-react';

interface Props {
  order: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function OrderDeferDialog({ order, open, onClose, onSaved }: Props) {
  const [deferDate, setDeferDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Minimum date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  async function handleDefer() {
    if (!deferDate) { toast.error('Bitte ein Datum auswählen'); return; }
    setSaving(true);
    const { error } = await supabase.from('orders').update({
      order_status: 'zurückgestellt',
      expected_shipment_date: deferDate,
    }).eq('id', order.id);
    if (error) {
      toast.error('Fehler: ' + error.message);
      setSaving(false);
      return;
    }
    // Add status history note
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      old_status: order.order_status || 'offen',
      new_status: 'zurückgestellt',
      change_note: `Zurückgestellt bis ${new Date(deferDate).toLocaleDateString('de-DE')}`,
    });
    setSaving(false);
    toast.success(`Auftrag zurückgestellt bis ${new Date(deferDate).toLocaleDateString('de-DE')}`);
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            Auftrag zurückstellen
          </DialogTitle>
          <DialogDescription>
            Auftrag <span className="font-medium text-foreground">{order.order_number}</span> wird bis zum gewählten Datum zurückgestellt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Zurückstellen bis</Label>
            <Input
              type="date"
              value={deferDate}
              min={minDate}
              onChange={e => setDeferDate(e.target.value)}
              className="bg-secondary border-border mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button onClick={handleDefer} disabled={saving || !deferDate} className="gold-gradient text-primary-foreground">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Zurückstellen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
