import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface Item {
  id: string;
  item_name?: string | null;
  sku?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  rate?: number | null;
  discount?: number | null;
  tax_amount?: number | null;
  amount?: number | null;
}

interface Props {
  item: Item;
  orderId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function OrderSingleItemEditDialog({ item, orderId, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Item>(item);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(item); }, [item]);

  const patch = (p: Partial<Item>) => {
    setForm(prev => {
      const next = { ...prev, ...p };
      const q = Number(next.quantity ?? 0);
      const r = Number(next.rate ?? 0);
      const d = Number(next.discount ?? 0);
      next.amount = q * r - d;
      return next;
    });
  };

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.from('order_items').update({
        item_name: form.item_name,
        sku: form.sku,
        description: form.description,
        quantity: form.quantity,
        unit: form.unit,
        rate: form.rate,
        discount: form.discount,
        tax_amount: form.tax_amount,
        amount: form.amount,
      }).eq('id', form.id);
      if (error) throw error;

      // Gesamtbetrag des Auftrags neu berechnen
      const { data: allItems } = await supabase
        .from('order_items').select('amount').eq('order_id', orderId);
      const total = (allItems ?? []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
      await supabase.from('orders').update({ total_amount: total }).eq('id', orderId);

      await supabase.from('order_notes').insert({
        order_id: orderId,
        note_text: `Artikel bearbeitet: ${form.item_name ?? form.sku ?? form.id}`,
        note_type: 'correction',
        is_internal: true,
      });

      toast.success('Artikel gespeichert');
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast.error('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-lg border border-border bg-background p-6 shadow-lg">
        <button onClick={onClose} disabled={saving} className="absolute right-4 top-4 opacity-70 hover:opacity-100" aria-label="Schließen">
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-lg font-semibold mb-1">Artikel bearbeiten</h2>
        <p className="text-sm text-muted-foreground mb-4">Position #{form.id.slice(0, 8)}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Artikelname</Label>
            <Input value={form.item_name ?? ''} onChange={e => patch({ item_name: e.target.value })} className="bg-secondary border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">SKU</Label>
            <Input value={form.sku ?? ''} onChange={e => patch({ sku: e.target.value })} className="bg-secondary border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Einheit</Label>
            <Input value={form.unit ?? ''} onChange={e => patch({ unit: e.target.value })} className="bg-secondary border-border mt-1" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Beschreibung</Label>
            <Textarea value={form.description ?? ''} onChange={e => patch({ description: e.target.value })} className="bg-secondary border-border mt-1 min-h-[80px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Menge</Label>
            <Input type="number" step="0.01" value={form.quantity ?? ''} onChange={e => patch({ quantity: e.target.value === '' ? null : parseFloat(e.target.value) })} className="bg-secondary border-border mt-1 text-right" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Einzelpreis</Label>
            <Input type="number" step="0.01" value={form.rate ?? ''} onChange={e => patch({ rate: e.target.value === '' ? null : parseFloat(e.target.value) })} className="bg-secondary border-border mt-1 text-right" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Rabatt</Label>
            <Input type="number" step="0.01" value={form.discount ?? ''} onChange={e => patch({ discount: e.target.value === '' ? null : parseFloat(e.target.value) })} className="bg-secondary border-border mt-1 text-right" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Steuer</Label>
            <Input type="number" step="0.01" value={form.tax_amount ?? ''} onChange={e => patch({ tax_amount: e.target.value === '' ? null : parseFloat(e.target.value) })} className="bg-secondary border-border mt-1 text-right" />
          </div>
          <div className="col-span-2 mt-2 flex justify-between items-center rounded-md border border-border bg-secondary/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">Neuer Betrag</span>
            <span className="font-display font-bold text-primary">{Number(form.amount ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving} className="gold-gradient text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
