import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, X, ShieldAlert } from 'lucide-react';

const STATUS_OPTIONS = [
  'offen', 'bestätigt', 'in Bearbeitung', 'versendet', 'teilgeliefert', 'geliefert',
  'abgeschlossen', 'storniert', 'zurückgestellt', 'Hold', 'Anwalt',
];
const LAWYER_REASONS = ['Zahlungsverzug', 'Auftragserfüllung', 'Stornierung', 'Keine Anzahlung'];
const PAYMENT_STATUS = ['', 'open', 'partial', 'paid', 'overdue', 'cancelled'];

interface Props {
  order: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function dateInput(v: any) {
  if (!v) return '';
  try { return new Date(v).toISOString().split('T')[0]; } catch { return ''; }
}

export default function OrderFullEditDialog({ order, open, onClose, onSaved }: Props) {
  const isZoho = useMemo(() => String(order?.source_system || '').startsWith('zoho'), [order]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!order) return;
    setForm({
      order_number: order.order_number || '',
      external_order_id: order.external_order_id || '',
      internal_number: order.internal_number || '',
      case_number: order.case_number || '',
      order_status: order.order_status || 'offen',
      currency: order.currency || 'EUR',
      total_amount: order.total_amount?.toString() ?? '',
      order_date: dateInput(order.order_date),
      expected_shipment_date: dateInput(order.expected_shipment_date),
      salesperson_name: order.salesperson_name || '',
      lawyer_reason: order.lawyer_reason || '',
      deposit_amount: order.deposit_amount?.toString() ?? '',
      deposit_additional: order.deposit_additional?.toString() ?? '',
      deposit_booking_date: dateInput(order.deposit_booking_date),
      deposit_ok: !!order.deposit_ok,
      deposit_ok_by: order.deposit_ok_by || '',
      is_vip: !!order.is_vip,
      finance_payment_status: order.finance_payment_status || '',
      finance_total_amount: order.finance_total_amount?.toString() ?? '',
      finance_deposit_amount: order.finance_deposit_amount?.toString() ?? '',
      finance_remaining_amount: order.finance_remaining_amount?.toString() ?? '',
      finance_open_amount: order.finance_open_amount?.toString() ?? '',
      finance_paid_amount: order.finance_paid_amount?.toString() ?? '',
      finance_overdue_amount: order.finance_overdue_amount?.toString() ?? '',
    });
  }, [order]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !order) return null;

  const num = (v: string) => (v === '' || v == null ? null : Number(v));

  async function handleSave() {
    const intNum = String(form.internal_number || '').trim();
    if (intNum && !/^[A-Za-z0-9]{1,10}$/.test(intNum)) {
      toast.error('Intern Nummer: max. 10 Zeichen, nur Buchstaben und Zahlen');
      return;
    }
    if (form.deposit_ok && !String(form.deposit_ok_by || '').trim()) {
      toast.error('Bitte Mitarbeitername für "ANZAHLUNG OK" eintragen');
      return;
    }
    setSaving(true);

    const update: any = {
      order_status: form.order_status || null,
      currency: form.currency || null,
      total_amount: num(form.total_amount),
      order_date: form.order_date ? new Date(form.order_date).toISOString() : null,
      expected_shipment_date: form.expected_shipment_date ? new Date(form.expected_shipment_date).toISOString() : null,
      salesperson_name: form.salesperson_name || null,
      internal_number: intNum || null,
      case_number: form.case_number || null,
      external_order_id: form.external_order_id || null,
      lawyer_reason: form.order_status === 'Anwalt' ? (form.lawyer_reason || null) : null,
      deposit_amount: num(form.deposit_amount),
      deposit_additional: num(form.deposit_additional),
      deposit_booking_date: form.deposit_booking_date || null,
      deposit_ok: !!form.deposit_ok,
      deposit_ok_by: form.deposit_ok ? String(form.deposit_ok_by).trim() : null,
      deposit_ok_at: form.deposit_ok
        ? (order.deposit_ok && order.deposit_ok_at ? order.deposit_ok_at : new Date().toISOString())
        : null,
      is_vip: !!form.is_vip,
      finance_payment_status: form.finance_payment_status || null,
      finance_total_amount: num(form.finance_total_amount),
      finance_deposit_amount: num(form.finance_deposit_amount),
      finance_remaining_amount: num(form.finance_remaining_amount),
      finance_open_amount: num(form.finance_open_amount),
      finance_paid_amount: num(form.finance_paid_amount),
      finance_overdue_amount: num(form.finance_overdue_amount),
    };

    // Zoho-Auftragsnummer ist unveränderlich — niemals überschreiben
    if (!isZoho) {
      const newNum = String(form.order_number || '').trim();
      if (!newNum) {
        setSaving(false);
        toast.error('Auftragsnummer darf nicht leer sein');
        return;
      }
      update.order_number = newNum;
    }

    const { error } = await supabase.from('orders').update(update).eq('id', order.id);
    setSaving(false);
    if (error) { toast.error('Fehler beim Speichern: ' + error.message); return; }
    toast.success('Auftrag vollständig aktualisiert');
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-lg border bg-background p-6 shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-display font-semibold leading-none tracking-tight">
            Auftrag komplett bearbeiten <span className="text-xs text-muted-foreground font-normal">(Super Admin)</span>
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Achtung: Diese Maske überschreibt nahezu alle Auftragsdaten.
          {isZoho && ' Die Zoho-Auftragsnummer ist gesperrt und kann nicht geändert werden.'}
        </p>

        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Identifikation */}
          <section className="rounded-md border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Identifikation</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Auftragsnummer{isZoho && ' (gesperrt)'}</Label>
                <Input value={form.order_number} disabled={isZoho}
                  onChange={e => set('order_number', e.target.value)}
                  className="bg-secondary border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ext. Auftrags-ID</Label>
                <Input value={form.external_order_id} onChange={e => set('external_order_id', e.target.value)}
                  className="bg-secondary border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Intern Nummer</Label>
                <Input value={form.internal_number}
                  onChange={e => set('internal_number', e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10))}
                  maxLength={10} className="bg-secondary border-border mt-1 font-mono uppercase" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Aktenzeichen</Label>
                <Input value={form.case_number} onChange={e => set('case_number', e.target.value)}
                  className="bg-secondary border-border mt-1" />
              </div>
            </div>
          </section>

          {/* Status / Dates */}
          <section className="rounded-md border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Status & Daten</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.order_status} onValueChange={v => set('order_status', v)}>
                  <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.order_status === 'Anwalt' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Anwalt-Grund</Label>
                  <Select value={form.lawyer_reason} onValueChange={v => set('lawyer_reason', v)}>
                    <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue placeholder="Grund..." /></SelectTrigger>
                    <SelectContent>{LAWYER_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Bestelldatum</Label>
                <Input type="date" value={form.order_date} onChange={e => set('order_date', e.target.value)}
                  className="bg-secondary border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Erw. Versanddatum</Label>
                <Input type="date" value={form.expected_shipment_date}
                  onChange={e => set('expected_shipment_date', e.target.value)}
                  className="bg-secondary border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Verkäufer</Label>
                <Input value={form.salesperson_name} onChange={e => set('salesperson_name', e.target.value)}
                  className="bg-secondary border-border mt-1" />
              </div>
              <label className="flex items-end gap-2 cursor-pointer pb-2">
                <Checkbox checked={form.is_vip} onCheckedChange={v => set('is_vip', !!v)} />
                <span className="text-sm">VIP-Auftrag</span>
              </label>
            </div>
          </section>

          {/* Beträge */}
          <section className="rounded-md border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Beträge</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Gesamtbetrag</Label>
                <Input type="number" step="0.01" value={form.total_amount}
                  onChange={e => set('total_amount', e.target.value)} className="bg-secondary border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Währung</Label>
                <Input value={form.currency} onChange={e => set('currency', e.target.value)}
                  className="bg-secondary border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Anzahlung (vereinbart)</Label>
                <Input type="number" step="0.01" value={form.deposit_amount}
                  onChange={e => set('deposit_amount', e.target.value)} className="bg-secondary border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Zusatz-Anzahlung</Label>
                <Input type="number" step="0.01" value={form.deposit_additional}
                  onChange={e => set('deposit_additional', e.target.value)} className="bg-secondary border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Anzahlung Buchungsdatum</Label>
                <Input type="date" value={form.deposit_booking_date}
                  onChange={e => set('deposit_booking_date', e.target.value)} className="bg-secondary border-border mt-1" />
              </div>
              <div className="rounded-md border border-border bg-secondary/40 p-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.deposit_ok} onCheckedChange={v => set('deposit_ok', !!v)} />
                  <span className="text-xs font-semibold">ANZAHLUNG OK</span>
                </label>
                {form.deposit_ok && (
                  <Input value={form.deposit_ok_by} onChange={e => set('deposit_ok_by', e.target.value)}
                    placeholder="Mitarbeiter" className="bg-background border-border mt-2 h-8 text-xs" />
                )}
              </div>
            </div>
          </section>

          {/* Finance */}
          <section className="rounded-md border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Finance</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Payment Status</Label>
                <Select value={form.finance_payment_status || '__none__'}
                  onValueChange={v => set('finance_payment_status', v === '__none__' ? '' : v)}>
                  <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {PAYMENT_STATUS.filter(Boolean).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {[
                ['finance_total_amount', 'Total'],
                ['finance_deposit_amount', 'Anzahlung'],
                ['finance_paid_amount', 'Bezahlt'],
                ['finance_open_amount', 'Offen'],
                ['finance_remaining_amount', 'Rest'],
                ['finance_overdue_amount', 'Überfällig'],
              ].map(([k, l]) => (
                <div key={k}>
                  <Label className="text-xs text-muted-foreground">{l}</Label>
                  <Input type="number" step="0.01" value={form[k]}
                    onChange={e => set(k, e.target.value)} className="bg-secondary border-border mt-1" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 pt-5">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving} className="gold-gradient text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Alles speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
