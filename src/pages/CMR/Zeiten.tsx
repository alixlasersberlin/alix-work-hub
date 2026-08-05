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
import { Clock, Loader2, Plus, Receipt, Trash2, Play, Square, AlertTriangle, Check, Undo2 } from 'lucide-react';
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
  worked_by?: string | null;
  approved?: boolean | null;
  approved_at?: string | null;
};

type TeamMember = { user_id: string; full_name: string | null; email: string | null };

type Project = { id: string; name: string; code: string | null; customer_id: string | null; customer_name: string | null; budget: number | null };

const EMPTY = {
  project_id: '', work_date: new Date().toISOString().slice(0, 10),
  hours: 1, hourly_rate: 0, description: '', billable: true, worked_by: '',
};

/**
 * CMR Zeiterfassung – Stunden auf Projekte buchen und offene, abrechenbare
 * Zeiten als Sammelrechnung (auch projektübergreifend je Kunde) fakturieren.
 */
export default function CmrZeiten() {
  const { tenantId, settings, loading, canWrite } = useCmrTenant();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [billing, setBilling] = useState(false);
  const [tab, setTab] = useState<'offen' | 'alle' | 'woche' | 'budget'>('offen');
  const [timer, setTimer] = useState<{ projectId: string; startedAt: number } | null>(null);
  const [tick, setTick] = useState(0);

  const cur = settings?.default_currency || 'AED';

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const [{ data: e }, { data: p }, { data: t }] = await Promise.all([
      supabase.from('cmr_time_entries' as any).select('*').eq('tenant_id', tenantId)
        .order('work_date', { ascending: false }).limit(1000),
      supabase.from('cmr_projects' as any).select('id,name,code,customer_id,customer_name,budget')
        .eq('tenant_id', tenantId).order('name').limit(500),
      supabase.from('user_profiles').select('user_id,full_name,email')
        .eq('is_active', true).order('full_name').limit(500),
    ]);
    setEntries(((e as any) || []) as Entry[]);
    setProjects(((p as any) || []) as Project[]);
    setTeam(((t as any) || []) as TeamMember[]);
    setSelected(new Set());
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  // Laufenden Timer überdauert einen Reload der Seite
  useEffect(() => {
    const raw = localStorage.getItem('cmr_timer');
    if (raw) { try { setTimer(JSON.parse(raw)); } catch { /* ignorieren */ } }
  }, []);
  useEffect(() => {
    if (!timer) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [timer]);

  const elapsedHours = timer ? (Date.now() - timer.startedAt) / 3600000 : 0;
  const elapsedLabel = (() => {
    const total = Math.floor((timer ? Date.now() - timer.startedAt : 0) / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, '0');
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const sec = String(total % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  })();

  const startTimer = (projectId: string) => {
    const t = { projectId, startedAt: Date.now() };
    localStorage.setItem('cmr_timer', JSON.stringify(t));
    setTimer(t);
  };

  /** Stoppt den Timer und öffnet die Erfassungsmaske mit den gelaufenen Stunden. */
  const stopTimer = () => {
    if (!timer) return;
    const hours = Math.max(0.25, Math.round(elapsedHours * 4) / 4);
    localStorage.removeItem('cmr_timer');
    setTimer(null);
    setForm({ ...EMPTY, project_id: timer.projectId, hours });
    setOpen(true);
  };

  /** Wochenübersicht: Stunden je Kalenderwoche und Projekt. */
  const weeks = useMemo(() => {
    const map = new Map<string, { hours: number; value: number; entries: number }>();
    entries.forEach((e) => {
      const d = new Date(e.work_date);
      const day = (d.getDay() + 6) % 7;
      const monday = new Date(d); monday.setDate(d.getDate() - day);
      const key = monday.toISOString().slice(0, 10);
      const cur_ = map.get(key) ?? { hours: 0, value: 0, entries: 0 };
      cur_.hours += Number(e.hours || 0);
      cur_.value += Number(e.hours || 0) * Number(e.hourly_rate || 0);
      cur_.entries += 1;
      map.set(key, cur_);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  /** Budgetauslastung je Projekt inkl. Warnschwellen. */
  const budgets = useMemo(() => projects.map((p) => {
    const used = entries.filter((e) => e.project_id === p.id)
      .reduce((s, e) => s + Number(e.hours || 0) * Number(e.hourly_rate || 0), 0);
    const budget = Number(p.budget || 0);
    return { project: p, used, budget, pct: budget > 0 ? (used / budget) * 100 : null };
  }).filter((b) => b.used > 0 || b.budget > 0)
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)), [projects, entries]);

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
      worked_by: form.worked_by || auth?.user?.id || null,
      created_by: auth?.user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Zeit erfasst');
    setOpen(false);
    setForm(EMPTY);
    load();
  };

  /** Fremderfasste bzw. offene Zeiten freigeben oder Freigabe zurücknehmen. */
  const setApproved = async (e: Entry, approved: boolean) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('cmr_time_entries' as any).update({
      approved,
      approved_by: approved ? auth?.user?.id ?? null : null,
      approved_at: approved ? new Date().toISOString() : null,
    }).eq('id', e.id);
    if (error) { toast.error(error.message); return; }
    toast.success(approved ? 'Zeit freigegeben' : 'Freigabe zurückgenommen');
    load();
  };

  const memberName = (id?: string | null) => {
    const m = team.find((x) => x.user_id === id);
    return m?.full_name || m?.email || null;
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
            {timer
              ? (
                <Button variant="outline" onClick={stopTimer} className="text-amber-500 border-amber-500/40">
                  <Square className="w-4 h-4 mr-1.5" /> {elapsedLabel} stoppen
                </Button>
              )
              : (
                <Button
                  variant="outline"
                  disabled={!canWrite || projects.length === 0}
                  onClick={() => startTimer(form.project_id || projects[0]?.id || '')}
                >
                  <Play className="w-4 h-4 mr-1.5" /> Timer starten
                </Button>
              )}
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
        {(['offen', 'alle', 'woche', 'budget'] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => { setTab(t); setSelected(new Set()); }}>
            {t === 'offen' ? 'Offene Zeiten' : t === 'alle' ? 'Alle Zeiten' : t === 'woche' ? 'Wochenübersicht' : 'Budgets'}
          </Button>
        ))}
      </div>

      {tab === 'woche' && (
        <Card className="divide-y">
          {weeks.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Keine Zeiten erfasst.</div>}
          {weeks.map(([monday, w]) => {
            const end = new Date(monday); end.setDate(end.getDate() + 6);
            return (
              <div key={monday} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    KW {new Date(monday).toLocaleDateString('de-DE')} – {end.toLocaleDateString('de-DE')}
                  </div>
                  <div className="text-xs text-muted-foreground">{w.entries} Buchung(en)</div>
                </div>
                <div className="text-sm tabular-nums w-24 text-right">{w.hours.toFixed(2)} h</div>
                <div className="text-sm font-semibold tabular-nums w-32 text-right">{cmrMoney(w.value, cur)}</div>
              </div>
            );
          })}
        </Card>
      )}

      {tab === 'budget' && (
        <Card className="divide-y">
          {budgets.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Keine Projekte mit Budget oder Zeiten.</div>}
          {budgets.map((b) => (
            <div key={b.project.id} className="p-3 space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0 font-medium truncate">
                  {b.project.code ? `${b.project.code} · ` : ''}{b.project.name}
                  <span className="text-muted-foreground font-normal"> · {b.project.customer_name ?? 'Ohne Kunde'}</span>
                </div>
                {b.pct !== null && b.pct >= 80 && (
                  <Badge variant="outline" className={b.pct >= 100 ? 'border-red-500/40 text-red-500' : 'border-amber-500/40 text-amber-500'}>
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {b.pct >= 100 ? 'Budget überschritten' : 'Budget fast erreicht'}
                  </Badge>
                )}
                <div className="text-sm tabular-nums">
                  {cmrMoney(b.used, cur)}{b.budget > 0 ? ` / ${cmrMoney(b.budget, cur)}` : ' · kein Budget'}
                </div>
              </div>
              {b.pct !== null && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${b.pct >= 100 ? 'bg-red-500' : b.pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, b.pct)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {(tab === 'offen' || tab === 'alle') && (
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
                disabled={!!e.billed_document_id || !e.billable || !canWrite || !e.approved}
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
                  {memberName(e.worked_by) ? ` · ${memberName(e.worked_by)}` : ''}
                  {e.description ? ` · ${e.description}` : ''}
                </div>
              </div>
              {e.billed_document_id
                ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">abgerechnet</Badge>
                : e.billable
                  ? <Badge variant="outline" className="border-amber-500/40 text-amber-500">offen</Badge>
                  : <Badge variant="outline">nicht abrechenbar</Badge>}
              <Badge variant="outline" className={e.approved ? 'border-emerald-500/40 text-emerald-500' : 'border-muted-foreground/30'}>
                {e.approved ? 'freigegeben' : 'zu prüfen'}
              </Badge>
              <div className="w-28 text-right text-sm font-semibold tabular-nums">{cmrMoney(value, cur)}</div>
              <Button
                size="sm" variant="ghost" title={e.approved ? 'Freigabe zurücknehmen' : 'Freigeben'}
                disabled={!canWrite || !!e.billed_document_id} onClick={() => setApproved(e, !e.approved)}
              >
                {e.approved ? <Undo2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="ghost" disabled={!canWrite || !!e.billed_document_id} onClick={() => remove(e.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </Card>
      )}

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
            <div>
              <Label>Mitarbeiter</Label>
              <select
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.worked_by}
                onChange={(e) => setForm({ ...form, worked_by: e.target.value })}
              >
                <option value="">Ich selbst</option>
                {team.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.full_name || m.email || m.user_id}</option>
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
