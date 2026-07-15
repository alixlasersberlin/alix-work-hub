import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sbRepair } from '@/lib/repair/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PackagePlus, Loader2, X, Plus, Trash2 } from 'lucide-react';

interface Props {
  repair: any;
  onCreated?: () => void;
}

const PRIORITIES = ['niedrig', 'normal', 'hoch', 'dringend'];

type PartRow = {
  part_name: string;
  part_number: string;
  supplier: string;
  quantity: number;
  priority: string;
  notes: string;
};

const emptyRow = (): PartRow => ({
  part_name: '',
  part_number: '',
  supplier: '',
  quantity: 1,
  priority: 'normal',
  notes: '',
});

export function SparePartRequestDialog({ repair, onCreated }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PartRow[]>([emptyRow()]);

  const reset = () => setRows([emptyRow()]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const updateRow = (i: number, patch: Partial<PartRow>) => {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };
  const addRow = () => setRows(rs => [...rs, emptyRow()]);
  const removeRow = (i: number) => setRows(rs => rs.length <= 1 ? rs : rs.filter((_, idx) => idx !== i));

  const submit = async () => {
    const valid = rows.filter(r => r.part_name.trim());
    if (valid.length === 0) {
      toast({ title: 'Bezeichnung fehlt', description: 'Mindestens ein Teil mit Bezeichnung wird benötigt.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const device = [repair.device_brand, repair.device_model].filter(Boolean).join(' ')
        || repair.device_category || repair.device_type || '';

      let ticketNumber: string | null = null;
      if (repair.ticket_id) {
        const { data: t } = await supabase
          .from('tickets')
          .select('external_ticket_id')
          .eq('id', repair.ticket_id)
          .maybeSingle();
        ticketNumber = (t as any)?.external_ticket_id || null;
      }

      const now = new Date().toISOString();
      const payload = valid.map(r => ({
        repair_order_id: repair.id,
        part_name: r.part_name.trim(),
        part_number: r.part_number || null,
        supplier: r.supplier || null,
        quantity: Number(r.quantity) || 1,
        status: 'Bestellvorschlag',
        notes: r.notes || null,
        priority: r.priority,
        device_label: device || null,
        serial_number: repair.device_serial_number || null,
        ticket_id: repair.ticket_id || null,
        ticket_number: ticketNumber,
        requested_by: user?.id || null,
        requested_at: now,
      }));

      const { error } = await sbRepair.from('repair_spare_parts').insert(payload);
      if (error) throw error;

      try {
        const partsBlock = valid.map((r, i) =>
          `${i + 1}. ${r.part_name}${r.part_number ? ` (${r.part_number})` : ''} · Menge: ${r.quantity} · Priorität: ${r.priority}${r.supplier ? ` · Lieferant: ${r.supplier}` : ''}${r.notes ? `\n   Notiz: ${r.notes}` : ''}`
        ).join('\n');
        await supabase.from('mail_internal_messages').insert({
          sender_id: user?.id || null,
          recipient_department: 'einkauf',
          subject: `Neuer Bestellvorschlag · ${valid.length} Teil(e) (${repair.repair_number})`,
          body: [
            `Reparaturauftrag: ${repair.repair_number}`,
            ticketNumber ? `Ticket: ${ticketNumber}` : null,
            device ? `Gerät: ${device}` : null,
            repair.device_serial_number ? `Seriennummer: ${repair.device_serial_number}` : null,
            '',
            'Benötigte Teile:',
            partsBlock,
          ].filter(v => v !== null).join('\n'),
        });
      } catch (e) {
        console.warn('Benachrichtigung an Einkauf fehlgeschlagen', e);
      }

      toast({ title: `${valid.length} Bestellvorschlag/-vorschläge erstellt`, description: 'Einkauf wurde benachrichtigt.' });
      reset();
      setOpen(false);
      onCreated?.();
      navigate('/reparatur/auftraege');
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const anyValid = rows.some(r => r.part_name.trim());

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
        onClick={() => setOpen(true)}
      >
        <PackagePlus className="w-4 h-4 mr-1" /> Ersatzteil benötigt
      </Button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => !saving && setOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-lg border border-border bg-background p-6 shadow-2xl">
            <button
              onClick={() => !saving && setOpen(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
              aria-label="Schließen"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4 pr-8">
              <h2 className="text-lg font-semibold leading-none tracking-tight">Ersatzteil-Bestellvorschlag</h2>
              <p className="text-xs text-muted-foreground mt-1">Fügen Sie beliebig viele Teile hinzu.</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">Reparaturauftrag:</span> <span className="font-mono">{repair.repair_number}</span></div>
                <div><span className="text-muted-foreground">Gerät:</span> {[repair.device_brand, repair.device_model].filter(Boolean).join(' ') || repair.device_category || '—'}</div>
                <div><span className="text-muted-foreground">Seriennummer:</span> {repair.device_serial_number || '—'}</div>
                {repair.ticket_id && <div><span className="text-muted-foreground">Ticket-Verknüpfung:</span> vorhanden</div>}
              </div>

              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {rows.map((r, i) => (
                  <div key={i} className="rounded-md border border-border p-3 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Teil {i + 1}</span>
                      {rows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => removeRow(i)}
                          disabled={saving}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Entfernen
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <Label>Benötigtes Teil *</Label>
                        <Input value={r.part_name} onChange={e => updateRow(i, { part_name: e.target.value })} placeholder="z.B. Lüftermodul" />
                      </div>
                      <div>
                        <Label>Teilenummer</Label>
                        <Input value={r.part_number} onChange={e => updateRow(i, { part_number: e.target.value })} />
                      </div>
                      <div>
                        <Label>Lieferant-Vorschlag</Label>
                        <Input value={r.supplier} onChange={e => updateRow(i, { supplier: e.target.value })} />
                      </div>
                      <div>
                        <Label>Menge</Label>
                        <Input type="number" min={1} value={r.quantity} onChange={e => updateRow(i, { quantity: Number(e.target.value) || 1 })} />
                      </div>
                      <div>
                        <Label>Priorität</Label>
                        <Select value={r.priority} onValueChange={v => updateRow(i, { priority: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Notiz</Label>
                        <Textarea rows={2} value={r.notes} onChange={e => updateRow(i, { notes: e.target.value })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={saving} className="w-full">
                <Plus className="w-4 h-4 mr-1" /> Weiteres Teil hinzufügen
              </Button>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Abbrechen</Button>
              <Button onClick={submit} disabled={saving || !anyValid}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PackagePlus className="w-4 h-4 mr-1" />}
                An Einkauf senden ({rows.filter(r => r.part_name.trim()).length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
