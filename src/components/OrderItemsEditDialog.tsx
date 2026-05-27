import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  orderId: string;
  orderNumber?: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface Item {
  id: string;
  item_name: string | null;
  sku: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  item_order?: number | null;
  _isNew?: boolean;
}

export default function OrderItemsEditDialog({ orderId, orderNumber, open, onClose, onSaved }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setRemovedIds([]);
    setNote('');
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_items')
        .select('id, item_name, sku, quantity, rate, amount, item_order')
        .eq('order_id', orderId)
        .order('item_order', { ascending: true });
      if (error) toast.error('Fehler beim Laden: ' + error.message);
      setItems((data ?? []) as Item[]);
      setLoading(false);
    })();
  }, [open, orderId]);

  const patchItem = (id: string, patch: Partial<Item>) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const next = { ...it, ...patch };
      const q = next.quantity;
      const r = next.rate;
      next.amount = q != null && r != null ? Number(q) * Number(r) : next.amount;
      return next;
    }));
  };

  const removeItem = (id: string, isNew?: boolean) => {
    if (!isNew) setRemovedIds(prev => [...prev, id]);
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `new-${crypto.randomUUID()}`,
      item_name: '',
      sku: '',
      quantity: 1,
      rate: 0,
      amount: 0,
      item_order: (prev[prev.length - 1]?.item_order ?? prev.length) + 1,
      _isNew: true,
    }]);
  };

  const newTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  async function handleSave() {
    setSaving(true);
    try {
      // Delete removed
      if (removedIds.length > 0) {
        const { error } = await supabase.from('order_items').delete().in('id', removedIds);
        if (error) throw error;
      }

      // Update existing & insert new
      for (const it of items) {
        if (it._isNew) {
          const { error } = await supabase.from('order_items').insert({
            order_id: orderId,
            item_name: it.item_name,
            sku: it.sku,
            quantity: it.quantity,
            rate: it.rate,
            amount: it.amount,
            item_order: it.item_order ?? 0,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('order_items')
            .update({
              item_name: it.item_name,
              sku: it.sku,
              quantity: it.quantity,
              rate: it.rate,
              amount: it.amount,
            })
            .eq('id', it.id);
          if (error) throw error;
        }
      }

      const { error: ordErr } = await supabase
        .from('orders')
        .update({ total_amount: newTotal, order_status: 'offen' })
        .eq('id', orderId);
      if (ordErr) throw ordErr;

      await supabase.from('order_notes').insert({
        order_id: orderId,
        note_text: `Artikelliste bearbeitet. Neuer Betrag: ${newTotal.toFixed(2)}${note ? ` — ${note}` : ''}`,
        note_type: 'correction',
        is_internal: true,
      });

      toast.success('Auftrag aktualisiert');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('Fehler beim Speichern: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Artikelliste bearbeiten {orderNumber ? `– ${orderNumber}` : ''}</DialogTitle>
          <DialogDescription>
            Artikel hinzufügen, entfernen oder ändern. Der Auftrag wird neu berechnet und auf Status „offen" gesetzt.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Artikel</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium w-32">SKU</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium w-28">Preis</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">Menge</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium w-28">Betrag</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(it => (
                    <tr key={it.id} className={it._isNew ? 'bg-primary/5' : ''}>
                      <td className="px-2 py-1.5">
                        <Input
                          value={it.item_name ?? ''}
                          onChange={e => patchItem(it.id, { item_name: e.target.value })}
                          className="h-8 bg-secondary border-border"
                          placeholder="Artikelname"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={it.sku ?? ''}
                          onChange={e => patchItem(it.id, { sku: e.target.value })}
                          className="h-8 bg-secondary border-border"
                          placeholder="SKU"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.rate ?? ''}
                          onChange={e => patchItem(it.id, { rate: e.target.value === '' ? null : parseFloat(e.target.value) })}
                          className="h-8 text-right bg-secondary border-border"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.quantity ?? ''}
                          onChange={e => patchItem(it.id, { quantity: e.target.value === '' ? null : parseFloat(e.target.value) })}
                          className="h-8 text-right bg-secondary border-border"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-foreground">
                        {it.amount != null ? Number(it.amount).toFixed(2) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeItem(it.id, it._isNew)}
                          title="Entfernen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Keine Artikel.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/30 border-t border-border">
                    <td colSpan={4} className="px-3 py-2 text-right text-muted-foreground">Neuer Gesamtbetrag</td>
                    <td className="px-3 py-2 text-right font-display font-bold text-primary">{newTotal.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Position hinzufügen
              </Button>
              <span className="text-xs text-muted-foreground">
                {removedIds.length > 0 && `${removedIds.length} zu löschen · `}
                {items.filter(i => i._isNew).length > 0 && `${items.filter(i => i._isNew).length} neu`}
              </span>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Notiz (optional)</Label>
              <Input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Grund der Änderung..."
                className="bg-secondary border-border mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose} disabled={saving}>Abbrechen</Button>
              <Button onClick={handleSave} disabled={saving} className="gold-gradient text-primary-foreground">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Speichern
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
