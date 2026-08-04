import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { toast } from '@/hooks/use-toast';
import { Loader2, Search, Check } from 'lucide-react';

type OrderHit = {
  id: string;
  order_number: string | null;
  order_status: string | null;
  currency: string | null;
  total_amount: number | null;
  order_date: string | null;
  salesperson_name: string | null;
  source_system: string | null;
  customer_id: string | null;
  customers?: { company_name: string | null; contact_name: string | null; email: string | null } | null;
};

type Form = {
  order_id: string | null;
  order_number: string;
  recurrence_name: string;
  reference_number: string;
  customer_id: string | null;
  customer_name: string;
  company_name: string;
  email: string;
  salesperson_name: string;
  source_system: string;
  currency: string;
  total: number;
  repeat_every: number;
  recurrence_frequency: string;
  start_date: string;
  end_date: string;
  next_invoice_date: string;
  status: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): Form => ({
  order_id: null,
  order_number: '',
  recurrence_name: '',
  reference_number: '',
  customer_id: null,
  customer_name: '',
  company_name: '',
  email: '',
  salesperson_name: '',
  source_system: 'zoho_eu_1',
  currency: 'EUR',
  total: 0,
  repeat_every: 1,
  recurrence_frequency: 'months',
  start_date: today(),
  end_date: '',
  next_invoice_date: today(),
  status: 'active',
});

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  region: 'EU' | 'CH';
  onCreated?: () => void;
};

export function RecurringProfileCreateDialog({ open, onOpenChange, region, onCreated }: Props) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<OrderHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setTerm(''); setHits([]); setForm(emptyForm()); }
  }, [open]);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setHits([]); return; }
    setSearching(true);
    const h = setTimeout(async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, order_status, currency, total_amount, order_date, salesperson_name, source_system, customer_id, customers(company_name, contact_name, email)')
        .ilike('order_number', `%${q}%`)
        .order('order_date', { ascending: false, nullsFirst: false })
        .limit(20);
      let list = (data ?? []) as unknown as OrderHit[];
      if (list.length === 0) {
        // Fallback: Kundensuche
        const { data: cust } = await supabase
          .from('customers')
          .select('id')
          .or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(20);
        const ids = (cust ?? []).map((c: any) => c.id);
        if (ids.length) {
          const { data: ord } = await supabase
            .from('orders')
            .select('id, order_number, order_status, currency, total_amount, order_date, salesperson_name, source_system, customer_id, customers(company_name, contact_name, email)')
            .in('customer_id', ids)
            .order('order_date', { ascending: false, nullsFirst: false })
            .limit(30);
          list = (ord ?? []) as unknown as OrderHit[];
        }
      }
      setHits(list);
      setSearching(false);
    }, 250);
    return () => clearTimeout(h);
  }, [term]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  function pickOrder(o: OrderHit) {
    const company = o.customers?.company_name || o.customers?.contact_name || '';
    const num = o.order_number || '';
    set({
      order_id: o.id,
      order_number: num,
      recurrence_name: `${num}${company ? ` · ${company}` : ''}`.trim(),
      reference_number: num,
      customer_id: o.customer_id,
      customer_name: o.customers?.contact_name || company,
      company_name: company,
      email: o.customers?.email || '',
      salesperson_name: o.salesperson_name || '',
      source_system: o.source_system || 'zoho_eu_1',
      currency: o.currency || (region === 'CH' ? 'CHF' : 'EUR'),
      total: Number(o.total_amount || 0),
      start_date: o.order_date ? String(o.order_date).slice(0, 10) : today(),
      next_invoice_date: o.order_date ? String(o.order_date).slice(0, 10) : today(),
    });
    setTerm(num);
    setHits([]);
  }

  const canSave = useMemo(() => !!form.recurrence_name.trim() && form.total > 0, [form]);

  async function save() {
    setSaving(true);
    const payload: Record<string, any> = {
      source_system: form.source_system || 'zoho_eu_1',
      zoho_recurring_invoice_id: `manual-${crypto.randomUUID()}`,
      recurrence_name: form.recurrence_name.trim(),
      reference_number: form.reference_number || null,
      status: form.status,
      customer_id: form.customer_id,
      customer_name: form.customer_name || null,
      company_name: form.company_name || null,
      email: form.email || null,
      salesperson_name: form.salesperson_name || null,
      recurrence_frequency: form.recurrence_frequency,
      repeat_every: form.repeat_every || 1,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      next_invoice_date: form.next_invoice_date || null,
      total: form.total,
      currency: form.currency || 'EUR',
      accounting_region: region,
      raw_data: form.order_id ? { created_from_order_id: form.order_id, order_number: form.order_number, manual: true } : { manual: true },
    };
    const { error } = await supabase.from('zoho_recurring_profiles').insert(payload as any);
    setSaving(false);
    if (error) {
      toast({ title: 'Neuanlage fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Vertrag angelegt', description: form.recurrence_name });
    onOpenChange(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuanlage wiederkehrender Zahler</DialogTitle>
          <DialogDescription>
            Auftrag suchen und auswählen — die hinterlegten Parameter werden übernommen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Auftrag suchen</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9"
                placeholder="Auftragsnummer, Kunde oder E-Mail…"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {hits.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {hits.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pickOrder(o)}
                    className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{o.order_number || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {o.customers?.company_name || o.customers?.contact_name || '—'}
                        </p>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Number(o.total_amount || 0).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {form.order_id && (
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <Check className="w-3 h-3" /> Übernommen aus Auftrag {form.order_number}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Vertragsname</Label>
            <Input value={form.recurrence_name} onChange={(e) => set({ recurrence_name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Kunde / Firma</Label>
              <Input value={form.company_name} onChange={(e) => set({ company_name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>E-Mail</Label>
              <Input value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Referenz</Label>
              <Input value={form.reference_number} onChange={(e) => set({ reference_number: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Betrag ({form.currency})</Label>
              <Input type="number" step="0.01" value={form.total} onChange={(e) => set({ total: Number(e.target.value) })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="pruefung">Prüfung</SelectItem>
                  <SelectItem value="stopped">stopped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Alle</Label>
              <Input type="number" min={1} value={form.repeat_every} onChange={(e) => set({ repeat_every: Number(e.target.value) })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Frequenz</Label>
              <Select value={form.recurrence_frequency} onValueChange={(v) => set({ recurrence_frequency: v })}>
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

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Start</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Ende</Label>
              <Input type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Nächste Rechnung</Label>
              <Input type="date" value={form.next_invoice_date} onChange={(e) => set({ next_invoice_date: e.target.value })} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving || !canSave}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
