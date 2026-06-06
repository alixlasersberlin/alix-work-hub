import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Banknote, ExternalLink } from 'lucide-react';

type Props = { repair: any; onCreated?: () => void };

export function InvoiceProposalDialog({ repair, onCreated }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState<any | null>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [hours, setHours] = useState<string>('');
  const [rate, setRate] = useState<string>('95');
  const [shipping, setShipping] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isClosed = repair?.repair_status === 'Reparatur abgeschlossen' || repair?.repair_status === 'An Finance übergeben';

  useEffect(() => {
    if (!repair?.id) return;
    (async () => {
      const [{ data: ex }, { data: pl }] = await Promise.all([
        sbRepair.from('repair_invoice_proposals').select('id,status,created_at,total_amount,currency').eq('repair_order_id', repair.id).order('created_at', { ascending: false }).limit(1),
        sbRepair.from('repair_parts').select('item_name,sku,quantity,supplier_name').eq('repair_order_id', repair.id),
      ]);
      setExisting(ex?.[0] || null);
      setParts(pl || []);
      if (repair.ticket_id) {
        const { data: t } = await supabase.from('tickets').select('ticket_number').eq('id', repair.ticket_id).maybeSingle();
        setTicketNumber(t?.ticket_number || null);
      }
    })();
  }, [repair?.id, repair?.ticket_id, open]);

  const partsTotal = 0; // keine Preise an Ersatzteilen vorhanden – Finance ergänzt
  const laborCost = (Number(hours) || 0) * (Number(rate) || 0);
  const total = laborCost + partsTotal + (Number(shipping) || 0);

  const submit = async () => {
    if (!repair?.id) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const partsSnapshot = parts.map((p) => ({
      item_name: p.item_name,
      sku: p.sku,
      quantity: p.quantity,
      supplier_name: p.supplier_name,
    }));
    const payload = {
      repair_order_id: repair.id,
      repair_number: repair.repair_number,
      ticket_id: repair.ticket_id || null,
      ticket_number: ticketNumber,
      customer_id: repair.customer_id || null,
      customer_name: repair.customer_name || null,
      customer_company: repair.customer_company || null,
      customer_email: repair.customer_email || null,
      customer_phone: repair.customer_phone || null,
      device_label: [repair.device_brand, repair.device_model].filter(Boolean).join(' ') || repair.device_category || null,
      device_serial: repair.device_serial_number || null,
      labor_hours: Number(hours) || 0,
      labor_rate: Number(rate) || 0,
      labor_cost: laborCost,
      parts: partsSnapshot,
      parts_total: partsTotal,
      shipping_cost: Number(shipping) || 0,
      total_amount: total,
      currency: repair.currency || 'EUR',
      status: 'offen',
      notes: notes || null,
      created_by: u?.user?.id || null,
    };
    const { error } = await sbRepair.from('repair_invoice_proposals').insert(payload);
    setSaving(false);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Rechnungsvorschlag erstellt', description: 'Finance wurde informiert.' });
    setOpen(false);
    onCreated?.();
  };

  if (!isClosed) return null;

  if (existing) {
    return (
      <Link to="/finance/rechnungsvorschlaege">
        <Button variant="outline" size="sm" className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
          <Banknote className="w-4 h-4 mr-1" /> Rechnungsvorschlag ({existing.status}) <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </Link>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
          <Banknote className="w-4 h-4 mr-1" /> An Finance übergeben
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rechnungsvorschlag erstellen</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Kunde</Label><div className="font-medium">{repair.customer_name || '–'}</div></div>
            <div><Label className="text-xs">Reparatur</Label><div className="font-mono">{repair.repair_number}</div></div>
            <div><Label className="text-xs">Gerät</Label><div>{[repair.device_brand, repair.device_model].filter(Boolean).join(' ') || '–'}</div></div>
            <div><Label className="text-xs">Seriennr.</Label><div className="font-mono">{repair.device_serial_number || '–'}</div></div>
            <div><Label className="text-xs">Ticket</Label><div className="font-mono">{ticketNumber || '–'}</div></div>
            <div><Label className="text-xs">Ersatzteile</Label><div>{parts.length} Pos.</div></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Arbeitszeit (Std.)</Label>
              <Input type="number" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Stundensatz</Label>
              <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Versandkosten</Label>
              <Input type="number" step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Notiz für Finance</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-between items-center bg-muted/40 rounded p-3">
            <span className="text-xs text-muted-foreground">Gesamt (Arbeit + Versand)</span>
            <span className="text-lg font-semibold">{total.toFixed(2)} {repair.currency || 'EUR'}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Speichere…' : 'Vorschlag erstellen'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
