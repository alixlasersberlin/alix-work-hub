import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PackagePlus, Loader2 } from 'lucide-react';

interface Props {
  repair: any;
  onCreated?: () => void;
}

const PRIORITIES = ['niedrig', 'normal', 'hoch', 'dringend'];

export function SparePartRequestDialog({ repair, onCreated }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    part_name: '',
    part_number: '',
    supplier: '',
    quantity: 1,
    priority: 'normal',
    notes: '',
  });

  const reset = () => setF({ part_name: '', part_number: '', supplier: '', quantity: 1, priority: 'normal', notes: '' });

  const submit = async () => {
    if (!f.part_name.trim()) {
      toast({ title: 'Bezeichnung fehlt', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const device = [repair.device_brand, repair.device_model].filter(Boolean).join(' ')
        || repair.device_category || repair.device_type || '';

      // Ticket-Nummer (falls verknüpft) laden für Anzeige im Bestellwesen
      let ticketNumber: string | null = null;
      if (repair.ticket_id) {
        const { data: t } = await supabase
          .from('tickets')
          .select('external_ticket_id')
          .eq('id', repair.ticket_id)
          .maybeSingle();
        ticketNumber = (t as any)?.external_ticket_id || null;
      }

      const { error } = await sbRepair.from('repair_spare_parts').insert({
        repair_order_id: repair.id,
        part_name: f.part_name.trim(),
        part_number: f.part_number || null,
        supplier: f.supplier || null,
        quantity: Number(f.quantity) || 1,
        status: 'Bestellvorschlag',
        notes: f.notes || null,
        priority: f.priority,
        device_label: device || null,
        serial_number: repair.device_serial_number || null,
        ticket_id: repair.ticket_id || null,
        ticket_number: ticketNumber,
        requested_by: user?.id || null,
        requested_at: new Date().toISOString(),
      });
      if (error) throw error;

      // Benachrichtigung an Einkauf (best effort, kein Fehler nach außen)
      try {
        await supabase.from('mail_internal_messages').insert({
          sender_id: user?.id || null,
          recipient_department: 'einkauf',
          subject: `Neuer Bestellvorschlag · ${f.part_name} (${repair.repair_number})`,
          body: [
            `Reparaturauftrag: ${repair.repair_number}`,
            ticketNumber ? `Ticket: ${ticketNumber}` : null,
            device ? `Gerät: ${device}` : null,
            repair.device_serial_number ? `Seriennummer: ${repair.device_serial_number}` : null,
            `Teil: ${f.part_name}${f.part_number ? ` (${f.part_number})` : ''}`,
            `Menge: ${f.quantity}`,
            `Priorität: ${f.priority}`,
            f.supplier ? `Lieferant-Vorschlag: ${f.supplier}` : null,
            f.notes ? `Notiz: ${f.notes}` : null,
          ].filter(Boolean).join('\n'),
        });
      } catch (e) {
        console.warn('Benachrichtigung an Einkauf fehlgeschlagen', e);
      }

      toast({ title: 'Bestellvorschlag erstellt', description: 'Einkauf wurde benachrichtigt.' });
      reset();
      setOpen(false);
      onCreated?.();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10">
          <PackagePlus className="w-4 h-4 mr-1" /> Ersatzteil benötigt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ersatzteil-Bestellvorschlag</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
            <div><span className="text-muted-foreground">Reparaturauftrag:</span> <span className="font-mono">{repair.repair_number}</span></div>
            <div><span className="text-muted-foreground">Gerät:</span> {[repair.device_brand, repair.device_model].filter(Boolean).join(' ') || repair.device_category || '—'}</div>
            <div><span className="text-muted-foreground">Seriennummer:</span> {repair.device_serial_number || '—'}</div>
            {repair.ticket_id && <div><span className="text-muted-foreground">Ticket-Verknüpfung:</span> vorhanden</div>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Benötigtes Teil *</Label>
              <Input value={f.part_name} onChange={e => setF({ ...f, part_name: e.target.value })} placeholder="z.B. Lüftermodul" />
            </div>
            <div>
              <Label>Teilenummer</Label>
              <Input value={f.part_number} onChange={e => setF({ ...f, part_number: e.target.value })} />
            </div>
            <div>
              <Label>Lieferant-Vorschlag</Label>
              <Input value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })} />
            </div>
            <div>
              <Label>Menge</Label>
              <Input type="number" min={1} value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>Priorität</Label>
              <Select value={f.priority} onValueChange={v => setF({ ...f, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Notiz</Label>
              <Textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving || !f.part_name.trim()}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PackagePlus className="w-4 h-4 mr-1" />}
            An Einkauf senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
