import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
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
}

export default function OrderItemsEditDialog({ orderId, orderNumber, open, onClose, onSaved }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_items')
        .select('id, item_name, sku, quantity, rate, amount')
        .eq('order_id', orderId)
        .order('item_order', { ascending: true });
      if (error) toast.error('Fehler beim Laden: ' + error.message);
      setItems((data ?? []) as Item[]);
      setLoading(false);
    })();
  }, [open, orderId]);

  const updateQty = (id: string, qty: string) => {
    const q = qty === '' ? null : parseFloat(qty);
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const newAmount = q != null && it.rate != null ? q * Number(it.rate) : it.amount;
      return { ...it, quantity: q, amount: newAmount };
    }));
  };

  const newTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  async function handleSave() {
    setSaving(true);
    try {
      // Update each item
      for (const it of items) {
        const { error } = await supabase
          .from('order_items')
          .update({ quantity: it.quantity, amount: it.amount })
          .eq('id', it.id);
        if (error) throw error;
      }

      // Update order: new total, status back to "offen" (erneut fällig stellen)
      const { error: ordErr } = await supabase
        .from('orders')
        .update({ total_amount: newTotal, order_status: 'offen' })
        .eq('id', orderId);
      if (ordErr) throw ordErr;

      // Status history note
      await supabase.from('order_notes').insert({
        order_id: orderId,
        note_text: `Mengenkorrektur aus Teilgeliefert. Neuer Betrag: ${newTotal.toFixed(2)}${note ? ` — ${note}` : ''}`,
        note_type: 'correction',
        is_internal: true,
      });

      toast.success('Auftrag aktualisiert und erneut fällig gestellt');
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Mengen korrigieren {orderNumber ? `– ${orderNumber}` : ''}</DialogTitle>
          <DialogDescription>
            Korrigiere die gelieferten Mengen. Der Auftrag wird neu berechnet und auf Status „offen" zurückgesetzt (erneut fällig).
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
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">SKU</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Preis</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium w-32">Menge</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Betrag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(it => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-foreground">{it.item_name || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{it.sku || '—'}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {it.rate != null ? Number(it.rate).toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.quantity ?? ''}
                          onChange={e => updateQty(it.id, e.target.value)}
                          className="h-8 text-right bg-secondary border-border"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">
                        {it.amount != null ? Number(it.amount).toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Keine Artikel.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/30 border-t border-border">
                    <td colSpan={4} className="px-3 py-2 text-right text-muted-foreground">Neuer Gesamtbetrag</td>
                    <td className="px-3 py-2 text-right font-display font-bold text-primary">{newTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Notiz (optional)</Label>
              <Input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Grund der Korrektur..."
                className="bg-secondary border-border mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose} disabled={saving}>Abbrechen</Button>
              <Button onClick={handleSave} disabled={saving || items.length === 0} className="gold-gradient text-primary-foreground">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Speichern & erneut fällig stellen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
