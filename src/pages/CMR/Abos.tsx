import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Plus, Repeat, Trash2, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';

type PlanLine = { name: string; quantity: number; unit: string; unit_price: number; tax_rate: number };
type Plan = {
  id: string; name: string; customer_id: string | null; customer_name: string | null; customer_email: string | null;
  interval_unit: string; next_run_date: string; currency: string; tax_rate: number;
  lines: PlanLine[]; notes: string | null; is_active: boolean; last_run_at: string | null;
};

const INTERVALS = [
  { value: 'monthly', label: 'monatlich' },
  { value: 'quarterly', label: 'quartalsweise' },
  { value: 'yearly', label: 'jährlich' },
];

export default function CmrAbos() {
  const { tenantId, settings, loading, canWrite} = useCmrTenant();
  const [rows, setRows] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState<any[]>([]);

  const cur = settings?.default_currency || 'AED';
  const defTax = Number(settings?.tax_rate ?? 5);

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const { data } = await supabase.from('cmr_recurring_plans' as any)
      .select('*').eq('tenant_id', tenantId).order('next_run_date');
    setRows(((data as any) || []).map((r: any) => ({ ...r, lines: Array.isArray(r.lines) ? r.lines : [] })) as Plan[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  useEffect(() => {
    if (custQuery.trim().length < 2) { setCustResults([]); return; }
    const t = setTimeout(async () => {
      const q = custQuery.trim();
      const { data } = await supabase.from('customers')
        .select('id, company_name, contact_name, email')
        .or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%`).limit(10);
      setCustResults((data as any) || []);
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery]);

  const emptyForm = () => ({
    name: '', customer_id: '', customer_name: '', customer_email: '', billing_address: '',
    interval_unit: 'monthly', next_run_date: new Date().toISOString().slice(0, 10),
    tax_rate: defTax, notes: '', is_active: true,
    lines: [{ name: '', quantity: 1, unit: 'Monat', unit_price: 0, tax_rate: defTax }] as PlanLine[],
  });

  const startNew = () => { setEditId(null); setForm(emptyForm()); setCustQuery(''); setOpen(true); };
  const startEdit = (p: Plan) => {
    setEditId(p.id);
    setForm({
      name: p.name, customer_id: p.customer_id ?? '', customer_name: p.customer_name ?? '',
      customer_email: p.customer_email ?? '', interval_unit: p.interval_unit, next_run_date: p.next_run_date,
      tax_rate: p.tax_rate, notes: p.notes ?? '', is_active: p.is_active,
      lines: p.lines.length ? p.lines : [{ name: '', quantity: 1, unit: 'Monat', unit_price: 0, tax_rate: defTax }],
    });
    setOpen(true);
  };

  const save = async () => {
    if (!tenantId || !form) return;
    if (!form.name.trim()) { toast.error('Bitte eine Bezeichnung angeben.'); return; }
    setSaving(true);
    const payload: any = {
      tenant_id: tenantId, name: form.name,
      customer_id: form.customer_id || null, customer_name: form.customer_name || null,
      customer_email: form.customer_email || null,
      interval_unit: form.interval_unit, next_run_date: form.next_run_date,
      currency: cur, tax_rate: Number(form.tax_rate) || 0,
      lines: (form.lines as PlanLine[]).filter((l) => l.name.trim()).map((l) => ({
        name: l.name, quantity: Number(l.quantity) || 0, unit: l.unit || 'Stück',
        unit_price: Number(l.unit_price) || 0, tax_rate: Number(l.tax_rate) || 0,
      })),
      notes: form.notes || null, is_active: !!form.is_active,
    };
    const { error } = editId
      ? await supabase.from('cmr_recurring_plans' as any).update(payload).eq('id', editId)
      : await supabase.from('cmr_recurring_plans' as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? 'Abo aktualisiert' : 'Abo angelegt');
    setOpen(false); load();
  };

  const toggleActive = async (p: Plan) => {
    const { error } = await supabase.from('cmr_recurring_plans' as any)
      .update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(p.is_active ? 'Abo pausiert' : 'Abo aktiviert');
    load();
  };

  const remove = async (p: Plan) => {
    if (!window.confirm(`Abo „${p.name}" wirklich löschen?`)) return;
    const { error } = await supabase.from('cmr_recurring_plans' as any).delete().eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const runNow = async (planId?: string) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('cmr-recurring-run', {
        body: { tenantId, planId: planId ?? null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${(data as any)?.created ?? 0} Rechnung(en) erzeugt`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Lauf fehlgeschlagen');
    } finally {
      setRunning(false);
    }
  };

  const monthlyFactor = (unit: string) => (unit === 'yearly' ? 1 / 12 : unit === 'quarterly' ? 1 / 3 : 1);

  const planTotal = (p: Plan) =>
    p.lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0) * (1 + Number(l.tax_rate || 0) / 100), 0);

  const mrr = rows.filter((p) => p.is_active)
    .reduce((s, p) => s + planTotal(p) * monthlyFactor(p.interval_unit), 0);

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="CMR Abrechnungen"
        subtitle="Wiederkehrende Abrechnung – erzeugt automatisch Rechnungen im Mandanten CMR."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => runNow()} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />} Lauf starten
            </Button>
            <Button onClick={startNew}><Plus className="w-4 h-4 mr-1.5" /> Neues Abo</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Abos gesamt</div><div className="text-xl font-semibold mt-1">{rows.length}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Aktiv</div><div className="text-xl font-semibold mt-1">{rows.filter((p) => p.is_active).length}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">MRR (aktiv)</div><div className="text-xl font-semibold mt-1">{cmrMoney(mrr, cur)}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Jahresumsatz (hochgerechnet)</div><div className="text-xl font-semibold mt-1">{cmrMoney(mrr * 12, cur)}</div></Card>
      </div>

      <Card className="divide-y">
        {rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Repeat className="w-5 h-5" /> Noch keine wiederkehrenden Abrechnungen.
          </div>
        )}
        {rows.map((p) => (
          <div key={p.id} className="p-3 flex items-center gap-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => startEdit(p)}>
              <div className="font-medium truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {p.customer_name ?? 'Ohne Kunde'} · {INTERVALS.find((i) => i.value === p.interval_unit)?.label}
                {' · nächster Lauf '}{new Date(p.next_run_date).toLocaleDateString('de-DE')}
                {p.last_run_at ? ` · zuletzt ${new Date(p.last_run_at).toLocaleDateString('de-DE')}` : ''}
              </div>
            </button>
            <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>
              {p.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Badge variant={p.is_active ? 'default' : 'outline'}>{p.is_active ? 'aktiv' : 'pausiert'}</Badge>
            <div className="text-sm font-semibold whitespace-nowrap">{cmrMoney(planTotal(p), p.currency || cur)}</div>
            <Button size="icon" variant="ghost" title="Nur dieses Abo abrechnen" onClick={() => runNow(p.id)} disabled={running}>
              <Play className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Abo bearbeiten' : 'Neues Abo'}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="md:col-span-2"><Label>Bezeichnung</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div>
                  <Label>Intervall</Label>
                  <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.interval_unit} onChange={(e) => setForm({ ...form, interval_unit: e.target.value })}>
                    {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div><Label>Nächster Lauf</Label><Input type="date" value={form.next_run_date} onChange={(e) => setForm({ ...form, next_run_date: e.target.value })} /></div>
              </div>

              <div className="space-y-2">
                <Label>Kunde</Label>
                <Input placeholder="Kunde suchen…" value={custQuery} onChange={(e) => setCustQuery(e.target.value)} />
                {custResults.length > 0 && (
                  <Card className="divide-y max-h-44 overflow-y-auto">
                    {custResults.map((c) => (
                      <button key={c.id} className="w-full text-left p-2 text-sm hover:bg-muted/50"
                        onClick={() => {
                          setForm({ ...form, customer_id: c.id, customer_name: c.company_name || c.contact_name || '', customer_email: c.email || '' });
                          setCustQuery(''); setCustResults([]);
                        }}>
                        {c.company_name || c.contact_name} <span className="text-muted-foreground">{c.email}</span>
                      </button>
                    ))}
                  </Card>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Kundenname</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value, customer_id: '' })} /></div>
                  <div><Label>E-Mail</Label><Input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Positionen</Label>
                  <Button size="sm" variant="outline"
                    onClick={() => setForm({ ...form, lines: [...form.lines, { name: '', quantity: 1, unit: 'Monat', unit_price: 0, tax_rate: defTax }] })}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Position
                  </Button>
                </div>
                {(form.lines as PlanLine[]).map((l, i) => (
                  <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                    <div className="md:col-span-2"><Input placeholder="Bezeichnung" value={l.name}
                      onChange={(e) => setForm({ ...form, lines: form.lines.map((x: PlanLine, j: number) => j === i ? { ...x, name: e.target.value } : x) })} /></div>
                    <Input type="number" placeholder="Menge" value={l.quantity}
                      onChange={(e) => setForm({ ...form, lines: form.lines.map((x: PlanLine, j: number) => j === i ? { ...x, quantity: Number(e.target.value) } : x) })} />
                    <Input placeholder="Einheit" value={l.unit}
                      onChange={(e) => setForm({ ...form, lines: form.lines.map((x: PlanLine, j: number) => j === i ? { ...x, unit: e.target.value } : x) })} />
                    <Input type="number" placeholder="Preis" value={l.unit_price}
                      onChange={(e) => setForm({ ...form, lines: form.lines.map((x: PlanLine, j: number) => j === i ? { ...x, unit_price: Number(e.target.value) } : x) })} />
                    <div className="flex gap-2">
                      <Input type="number" placeholder="MwSt. %" value={l.tax_rate}
                        onChange={(e) => setForm({ ...form, lines: form.lines.map((x: PlanLine, j: number) => j === i ? { ...x, tax_rate: Number(e.target.value) } : x) })} />
                      <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, lines: form.lines.filter((_: PlanLine, j: number) => j !== i) })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div><Label>Notizen (erscheinen auf der Rechnung)</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Aktiv
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
