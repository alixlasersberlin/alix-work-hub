import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export type EditableProfile = {
  id: string;
  recurrence_name: string | null;
  reference_number: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  next_invoice_date: string | null;
  total: number | null;
  repeat_every: number | null;
  recurrence_frequency: string | null;
};

type Props = {
  profile: EditableProfile | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
};

const d = (v: string | null) => (v ? String(v).slice(0, 10) : '');

export function RecurringProfileEditDialog({ profile, open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<EditableProfile | null>(profile);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(profile), [profile]);

  if (!form) return null;
  const set = (patch: Partial<EditableProfile>) => setForm((f) => (f ? { ...f, ...patch } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from('zoho_recurring_profiles')
      .update({
        recurrence_name: form.recurrence_name,
        reference_number: form.reference_number,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        next_invoice_date: form.next_invoice_date || null,
        total: form.total,
        repeat_every: form.repeat_every,
        recurrence_frequency: form.recurrence_frequency,
      } as any)
      .eq('id', form.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Speichern fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Vertrag aktualisiert' });
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Vertrag bearbeiten</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={form.recurrence_name ?? ''} onChange={(e) => set({ recurrence_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Referenz</Label>
              <Input value={form.reference_number ?? ''} onChange={(e) => set({ reference_number: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={(form.status ?? 'active').toLowerCase()} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="stopped">stopped</SelectItem>
                  <SelectItem value="expired">expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Start</Label>
              <Input type="date" value={d(form.start_date)} onChange={(e) => set({ start_date: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Ende</Label>
              <Input type="date" value={d(form.end_date)} onChange={(e) => set({ end_date: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Nächste</Label>
              <Input type="date" value={d(form.next_invoice_date)} onChange={(e) => set({ next_invoice_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Betrag</Label>
              <Input type="number" step="0.01" value={form.total ?? 0} onChange={(e) => set({ total: Number(e.target.value) })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Alle</Label>
              <Input type="number" min={1} value={form.repeat_every ?? 1} onChange={(e) => set({ repeat_every: Number(e.target.value) })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Frequenz</Label>
              <Select value={(form.recurrence_frequency ?? 'months').toLowerCase()} onValueChange={(v) => set({ recurrence_frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">days</SelectItem>
                  <SelectItem value="weeks">weeks</SelectItem>
                  <SelectItem value="months">months</SelectItem>
                  <SelectItem value="years">years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
