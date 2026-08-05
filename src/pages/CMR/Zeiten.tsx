import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Clock, Loader2, Plus, Receipt, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';
import CmrReadOnlyBanner from '@/components/cmr/CmrReadOnlyBanner';

type Entry = {
  id: string;
  project_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  work_date: string;
  hours: number;
  hourly_rate: number;
  description: string | null;
  billable: boolean;
  billed_document_id: string | null;
};

type Project = { id: string; name: string; code: string | null; customer_id: string | null; customer_name: string | null };

const EMPTY = {
  project_id: '', work_date: new Date().toISOString().slice(0, 10),
  hours: 1, hourly_rate: 0, description: '', billable: true,
};

/**
 * CMR Zeiterfassung – Stunden auf Projekte buchen und offene, abrechenbare
 * Zeiten als Sammelrechnung (auch projektübergreifend je Kunde) fakturieren.
 */
export default function CmrZeiten() {
  const { tenantId, settings, loading, canWrite } = useCmrTenant();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [billing, setBilling] = useState(false);
  const [tab, setTab] = useState<'offen' | 'alle'>('offen');

  const cur = settings?.default_currency || 'AED';

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from('cmr_time_entries' as any).select('*').eq('tenant_id', tenantId)
        .order('work_date', { ascending: false }).limit(1000),
      supabase.from('cmr_projects' as any).select('id,name,code,customer_id,customer_name')
        .eq('tenant_id', tenantId).order('name').limit(500),
    ]);
    setEntries(((e as any) || []) as Entry[]);
    setProjects(((p as any) || []) as Project[]);
    setSelected(new Set());
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const list = useMemo(
    () => (tab === 'offen' ? entries.filter((x) => x.billable && !x.billed_document_id) : entries),
    [entries, tab],
  );

  const totals = useMemo(() => ({
    hours: list.reduce((s, e) => s + Number(e.hours || 0), 0),
    value: list.reduce((s, e) => s + Number(e.hours || 0) * Number(e.hourly_rate || 0), 0),
    openValue: entries.filter((e) => e.billable && !e.billed_document_id)
      .reduce((s, e) => s + Number(e.hours || 0) * Number(e.hourly_rate || 0), 0),
  }), [list, entries]);

  const save = async () => {
    if (!tenantId) return;
    const project = projects.find((p) => p.id === form.project_id);
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('cmr_time_entries' as any).insert({
      tenant_id: tenantId,
      project_id: form.project_id || null,
      customer_id: project?.customer_id ?? null,
      customer_name: project?.customer_name ?? null,
      work_date: form.work_date,
      hours: Number(form.hours) || 0,
      hourly_rate: Number(form.hourly_rate) || 0,
      description: form.description || null,
      billable: !!form.billable,
      created_by: auth?.user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Zeit erfasst');
    setOpen(false);
    setForm(EMPTY);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('cmr_time_entries' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  /** Erzeugt aus den markierten Zeiten eine Sammelrechnung (je Projekt eine Position). */
  const createCollectiveInvoice = async () => {
    if (!tenantId) return;
    const rows = entries.filter((e) => selected.has(e.id));
    if (!rows.length) { toast.error('Bitte Zeiten auswählen'); return; }
    const customers = new Set(rows.map((r) => r.customer_id ?? r.customer_name ?? '—'));
    if (customers.size > 1) { toast.error('Bitte nur Zeiten eines Kunden auswählen'); return; }

    setBilling(true);
    const { data: nr, error: nrErr } = await supabase.rpc('cmr_next_document_number' as any, {
      _tenant_id: tenantId, _doc_type: 'rechnung',
    });
    if (nrErr) { setBilling(false); toast.error(nrErr.message); return; }

    // Positionen je Projekt bündeln
    const byProject = new Map<string, { name: string; hours: number; rate: number }>();
    rows.forEach((r) => {
      const key = r.project_id ?? 'ohne';
      const proj = projects.find((p) => p.id === r.project_id);
      const e = byProject.get(key) ?? { name: proj ? `${proj.code ? proj.code + ' · ' : ''}${proj.name}` : 'Leistungen', hours: 0, rate: Number(r.hourly_rate || 0) };
      e.hours += Number(r.hours || 0);
      byProject.set(key, e);
    });

    const taxRate = Number(settings?.tax_rate || 0);
    let net = 0;
    const items = [...byProject.values()].map((p, i) => {
      const total = Math.round(p.hours * p.rate * 100) / 100;
      net += total;
      return {
        position: i + 1, name: p.name, description: 'Zeitaufwand laut Zeiterfassung',
        quantity: p.hours, unit: 'Stunde', unit_price: p.rate,
        discount_pct: 0, tax_rate: taxRate, line_total: total,
      };
    });
    const tax = Math.round(net * (taxRate / 100) * 100) / 100;
    const first = rows[0];

    const { data: doc, error: docErr } = await supabase.from('cmr_documents' as any).insert({
      tenant_id: tenantId, doc_type: 'rechnung', doc_number: nr, status: 'entwurf',
      customer_id: first.customer_id, customer_name: first.customer_name,
      doc_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      currency: cur, tax_rate: taxRate,
      net_total: net, tax_total: tax, gross_total: net + tax, paid_total: 0,
      reference: 'Sammelrechnung Zeiterfassung',
      project_id: byProject.size === 1 ? (rows[0].project_id ?? null) : null,
    }).select('id').single();
    if (docErr) { setBilling(false); toast.error(docErr.message); return; }

    const docId = (doc as any).id as string;
    const { error: liErr } = await supabase.from('cmr_document_items' as any)
      .insert(items.map((it) => ({ ...it, document_id: docId })));
    if (liErr) { setBilling(false); toast.error(liErr.message); return; }

    const { error: upErr } = await supabase.from('cmr_time_entries' as any)
      .update({ billed_document_id: docId, billed_at: new Date().toISOString() })
      .in('id', rows.map((r) => r.id));
    setBilling(false);
    if (upErr) { toast.error(upErr.message); return; }
    toast.success(`Sammelrechnung ${nr} erstellt`);
    load();
  };

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {!canWrite && <CmrReadOnlyBanner />}
      <PageHeader
        title="CMR Zeiterfassung"
        subtitle="Stunden auf Projekte buchen und offene Leistungen als Sammelrechnung abrechnen."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={createCollectiveInvoice} disabled={!canWrite || billing || selected.size === 0}>
              {billing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Receipt className="w-4 h-4 mr-1.5" />}
              Sammelrechnung ({selected.size})
            </Button>
            <Button onClick={() => { setForm(EMPTY); setOpen(true); }} disabled={!canWrite}>
              <Plus className="w-4 h-4 mr-1.5" /> Zeit erfassen
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Stunden ({tab})</div><div className="text-xl font-semibold mt-1">{totals.hours.toFixed(2)}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Wert</div><div className="text-xl font-semibold mt-1">{cmrMoney(totals.value, cur)}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Offen abrechenbar</div><div className="text-xl font-semibold mt-1 text-amber-500">{cmrMoney(totals.openValue, cur)}</div></Card>
      </div>

      <div className="flex gap-2">
        {(['offen', 'alle'] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => { setTab(t); setSelected(new Set()); }}>
            {t === 'offen' ? 'Offene Zeiten' : 'Alle Zeiten'}
          </Button>
        ))}
      </div>

      <Card className="divide-y">
        {list.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Clock className="w-5 h-5" /> Keine Zeiten erfasst.
          </div>
        )}
        {list.map((e) => {
          const proj = projects.find((p) => p.id === e.project_id);
          const value = Number(e.hours || 0) * Number(e.hourly_rate || 0);
          return (
            <div key={e.id} className="p-3 flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                aria-label="Zeit auswählen"
                disabled={!!e.billed_document_id || !e.billable || !canWrite}
                checked={selected.has(e.id)}
                onChange={() => toggle(e.id)}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {proj ? `${proj.code ? proj.code + ' · ' : ''}${proj.name}` : 'Ohne Projekt'}
                  <span className="text-muted-foreground font-normal"> · {e.customer_name ?? 'Ohne Kunde'}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {new Date(e.work_date).toLocaleDateString('de-DE')} · {Number(e.hours).toFixed(2)} h
                  {e.description ? ` · ${e.description}` : ''}
                </div>
              </div>
              {e.billed_document_id
                ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">abgerechnet</Badge>
                : e.billable
                  ? <Badge variant="outline" className="border-amber-500/40 text-amber-500">offen</Badge>
                  : <Badge variant="outline">nicht abrechenbar</Badge>}
              <div className="w-28 text-right text-sm font-semibold tabular-nums">{cmrMoney(value, cur)}</div>
              <Button size="sm" variant="ghost" disabled={!canWrite || !!e.billed_document_id} onClick={() => remove(e.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Zeit erfassen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Projekt</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              >
                <option value="">Ohne Projekt</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Datum</Label><Input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} /></div>
              <div><Label>Stunden</Label><Input type="number" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
              <div><Label>Satz ({cur})</Label><Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></div>
            </div>
            <div><Label>Beschreibung</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={!!form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} />
              abrechenbar
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving || !canWrite}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
