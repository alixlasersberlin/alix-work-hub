import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Lock } from 'lucide-react';

interface Props {
  orderId: string;
}

export default function AtApprovalTab({ orderId }: Props) {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const canWrite = isSuperAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  const [rechnung, setRechnung] = useState(false);
  const [oder, setOder] = useState<string>('');
  const [bezahlt, setBezahlt] = useState(false);
  const [datumZahlung, setDatumZahlung] = useState('');
  const [rechnungswert, setRechnungswert] = useState('');
  const [restsumme, setRestsumme] = useState('');
  const [bestellfreigabe, setBestellfreigabe] = useState(false);
  const [name, setName] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    // Rechnungswert vorbefüllen aus Einkauf AT
    const { data: purchase } = await (supabase as any)
      .from('order_at_purchase')
      .select('einkaufspreis')
      .eq('order_id', orderId)
      .maybeSingle();

    const { data, error } = await (supabase as any)
      .from('order_at_approval')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      toast.error('Fehler beim Laden: ' + error.message);
    }
    if (data) {
      setRecordId(data.id);
      setRechnung(!!data.rechnung);
      setOder(data.oder || '');
      setBezahlt(!!data.bezahlt);
      setDatumZahlung(data.datum_zahlung || '');
      setRechnungswert(
        data.rechnungswert?.toString() ??
          (purchase?.einkaufspreis ? purchase.einkaufspreis.toString() : '')
      );
      setRestsumme(data.restsumme?.toString() ?? '');
      setBestellfreigabe(!!data.bestellfreigabe);
      setName(data.name || '');
      setUpdatedAt(data.updated_at);
    } else if (purchase?.einkaufspreis) {
      setRechnungswert(purchase.einkaufspreis.toString());
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleSave() {
    if (!canWrite) return;
    setSaving(true);
    const payload = {
      order_id: orderId,
      rechnung,
      oder: oder || null,
      bezahlt,
      datum_zahlung: datumZahlung || null,
      rechnungswert: rechnungswert ? parseFloat(rechnungswert) : null,
      restsumme: restsumme ? parseFloat(restsumme) : null,
      bestellfreigabe,
      name: name || null,
    };
    const { error } = recordId
      ? await (supabase as any).from('order_at_approval').update(payload).eq('id', recordId)
      : await (supabase as any).from('order_at_approval').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    toast.success('Freigabe AT gespeichert');
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
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent p-6 card-glow max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle2 className="w-4 h-4 text-amber-400" />
        <h2 className="text-base font-display font-bold text-foreground">Freigabe AT</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-6 flex items-center gap-1.5">
        <Lock className="w-3 h-3" />
        Sichtbar für Super Admin, Admin & Rolle „Österreich" · Bearbeitung nur durch Super Admin
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rechnung */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
          <Label className="text-sm">Rechnung</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={rechnung}
              onCheckedChange={(v) => setRechnung(!!v)}
              disabled={!canWrite}
            />
            <span className="text-xs text-muted-foreground w-8">{rechnung ? 'Ja' : 'Nein'}</span>
          </div>
        </div>

        {/* Oder DBX/BLN */}
        <div>
          <Label className="text-xs text-muted-foreground">Oder</Label>
          <Select value={oder || 'none'} onValueChange={(v) => setOder(v === 'none' ? '' : v)} disabled={!canWrite}>
            <SelectTrigger className="bg-secondary border-border mt-1">
              <SelectValue placeholder="– auswählen –" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">– keine Auswahl –</SelectItem>
              <SelectItem value="DBX">DBX</SelectItem>
              <SelectItem value="BLN">BLN</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bezahlt */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
          <Label className="text-sm">Bezahlt</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={bezahlt}
              onCheckedChange={(v) => setBezahlt(!!v)}
              disabled={!canWrite}
            />
            <span className="text-xs text-muted-foreground w-8">{bezahlt ? 'Ja' : 'Nein'}</span>
          </div>
        </div>

        {/* Datum Zahlung */}
        <div>
          <Label className="text-xs text-muted-foreground">Datum Zahlung</Label>
          <Input
            type="date"
            value={datumZahlung}
            onChange={(e) => setDatumZahlung(e.target.value)}
            disabled={!canWrite}
            className="bg-secondary border-border mt-1"
          />
        </div>

        {/* Rechnungswert */}
        <div>
          <Label className="text-xs text-muted-foreground">Rechnungswert (EUR)</Label>
          <Input
            type="number"
            step="0.01"
            value={rechnungswert}
            onChange={(e) => setRechnungswert(e.target.value)}
            disabled={!canWrite}
            placeholder="0,00"
            className="bg-secondary border-border mt-1 font-mono"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Vorbefüllt aus Einkauf AT</p>
        </div>

        {/* Restsumme */}
        <div>
          <Label className="text-xs text-muted-foreground">Restsumme nach Lieferung (EUR)</Label>
          <Input
            type="number"
            step="0.01"
            value={restsumme}
            onChange={(e) => setRestsumme(e.target.value)}
            disabled={!canWrite}
            placeholder="0,00"
            className="bg-secondary border-border mt-1 font-mono"
          />
        </div>

        {/* Bestellfreigabe */}
        <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5">
          <Label className="text-sm font-medium">Bestellfreigabe</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={bestellfreigabe}
              onCheckedChange={(v) => setBestellfreigabe(!!v)}
              disabled={!canWrite}
            />
            <span className="text-xs text-muted-foreground w-8">{bestellfreigabe ? 'Ja' : 'Nein'}</span>
          </div>
        </div>

        {/* Name */}
        <div>
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canWrite}
            className="bg-secondary border-border mt-1"
          />
        </div>
      </div>

      {updatedAt && (
        <p className="text-[11px] text-muted-foreground mt-6">
          Zuletzt aktualisiert: {new Date(updatedAt).toLocaleString('de-DE')}
        </p>
      )}

      {canWrite ? (
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving} className="gold-gradient text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Speichern
          </Button>
        </div>
      ) : (
        <p className="text-xs text-amber-400/80 italic mt-4">Nur lesend – Bearbeitung erfordert Super-Admin-Rolle.</p>
      )}
    </div>
  );
}
