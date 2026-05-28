import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, ShoppingBag, Lock } from 'lucide-react';

interface Props {
  orderId: string;
}

export default function AtPurchaseTab({ orderId }: Props) {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [einkaufspreis, setEinkaufspreis] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [note, setNote] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('order_at_purchase')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      toast.error('Fehler beim Laden: ' + error.message);
    }
    if (data) {
      setRecordId(data.id);
      setEinkaufspreis(data.einkaufspreis?.toString() ?? '');
      setCurrency(data.currency || 'EUR');
      setNote(data.note || '');
      setUpdatedAt(data.updated_at);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleSave() {
    if (!isSuperAdmin) return;
    setSaving(true);
    const payload = {
      order_id: orderId,
      einkaufspreis: einkaufspreis ? parseFloat(einkaufspreis) : null,
      currency: currency || 'EUR',
      note: note || null,
    };
    const { error } = recordId
      ? await (supabase as any).from('order_at_purchase').update(payload).eq('id', recordId)
      : await (supabase as any).from('order_at_purchase').insert(payload);
    setSaving(false);
    if (error) { toast.error('Speichern fehlgeschlagen: ' + error.message); return; }
    toast.success('Einkauf AT gespeichert');
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lädt…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent p-6 card-glow max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <ShoppingBag className="w-4 h-4 text-amber-400" />
        <h2 className="text-base font-display font-bold text-foreground">Einkauf AT</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-6 flex items-center gap-1.5">
        <Lock className="w-3 h-3" />
        Sichtbar für Super Admin & Rolle „Österreich" · Eintragen nur durch Super Admin
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Einkaufspreis</Label>
            <Input
              type="number"
              step="0.01"
              value={einkaufspreis}
              onChange={e => setEinkaufspreis(e.target.value)}
              disabled={!isSuperAdmin}
              placeholder="0,00"
              className="bg-secondary border-border mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Währung</Label>
            <Input
              value={currency}
              onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
              disabled={!isSuperAdmin}
              className="bg-secondary border-border mt-1 font-mono uppercase"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Notiz (optional)</Label>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={!isSuperAdmin}
            rows={3}
            className="bg-secondary border-border mt-1"
          />
        </div>

        {updatedAt && (
          <p className="text-[11px] text-muted-foreground">
            Zuletzt aktualisiert: {new Date(updatedAt).toLocaleString('de-DE')}
          </p>
        )}

        {isSuperAdmin ? (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} className="gold-gradient text-primary-foreground">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </div>
        ) : (
          <p className="text-xs text-amber-400/80 italic">Nur lesend – Bearbeitung erfordert Super-Admin-Rolle.</p>
        )}
      </div>
    </div>
  );
}
