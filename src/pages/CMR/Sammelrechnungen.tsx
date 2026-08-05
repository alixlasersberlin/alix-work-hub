import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Plus, Play, Trash2, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';
import CmrReadOnlyBanner from '@/components/cmr/CmrReadOnlyBanner';

type Plan = {
  id: string; name: string; customer_id: string | null; customer_name: string | null;
  customer_email: string | null; project_ids: string[]; interval_unit: string;
  next_run_date: string; currency: string; tax_rate: number; min_amount: number;
  auto_send: boolean; is_active: boolean; last_run_at: string | null;
};

const INTERVALS = [
  { value: 'woche', label: 'wöchentlich' },
  { value: 'monat', label: 'monatlich' },
  { value: 'quartal', label: 'quartalsweise' },
  { value: 'jahr', label: 'jährlich' },
];

/**
 * CMR Sammelabrechnung: wiederkehrende Sammelrechnungen ohne Abo –
 * bündelt offene Projektzeiten eines Kunden in einem Beleg.
 */
export default function CmrSammelrechnungen() {
  const { tenantId, settings, loading, canWrite } = useCmrTenant();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [openTimes, setOpenTimes] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [dlg, setDlg] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const cur = settings?.default_currency || 'AED';

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const [{ data: p }, { data: pr }, { data: te }] = await Promise.all([
      supabase.from('cmr_collective_plans' as any).select('*').eq('tenant_id', tenantId).order('next_run_date'),
      supabase.from('cmr_projects' as any).select('id,name,code,customer_id,customer_name').eq('tenant_id', tenantId).limit(500),
      supabase.from('cmr_time_entries' as any).select('customer_id,customer_name,hours,hourly_rate')
        .eq('tenant_id', tenantId).eq('billable', true).is('billed_document_id', null).limit(2000),
    ]);
    setPlans(((p as any) || []) as Plan[]);
    setProjects((pr as any) || []);
    setOpenTimes((te as any) || []);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const openByCustomer = useMemo(() => {
    const m = new Map<string, number>();
    openTimes.forEach((t) => {
      const key = t.customer_id ?? '—';
      m.set(key, (m.get(key) ?? 0) + Number(t.hours || 0) * Number(t.hourly_rate || 0));
    });
    return m;
  }, [openTimes]);

  const newPlan = () => setDlg({
    name: '', customer_id: '', customer_name: '', customer_email: '',
    project_ids: [] as string[], interval_unit: 'monat',
    next_run_date: new Date().toISOString().slice(0, 10),
    currency: cur, tax_rate: settings?.tax_rate ?? 0, min_amount: 0,
    auto_send: false, is_active: true,
  });

  const save = async () => {
    if (!tenantId || !dlg) return;
    if (!dlg.name?.trim()) { toast.error('Bitte einen Namen vergeben'); return; }
    setSaving(true);
    const payload: any = {
      tenant_id: tenantId,
      name: dlg.name.trim(),
      customer_id: dlg.customer_id || null,
      customer_name: dlg.customer_name || null,
      customer_email: dlg.customer_email || null,
      project_ids: dlg.project_ids ?? [],
      interval_unit: dlg.interval_unit,
      next_run_date: dlg.next_run_date,
      currency: dlg.currency || cur,
      tax_rate: Number(dlg.tax_rate) || 0,
      min_amount: Number(dlg.min_amount) || 0,
      auto_send: !!dlg.auto_send,
      is_active: !!dlg.is_active,
    };
    const { error } = dlg.id
      ? await supabase.from('cmr_collective_plans' as any).update(payload).eq('id', dlg.id)
      : await supabase.from('cmr_collective_plans' as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Sammelabrechnung gespeichert');
    setDlg(null);
    load();
  };

  const runNow = async (plan: Plan) => {
    setRunning(plan.id);
    const { data, error } = await supabase.functions.invoke('cmr-collective-run', {
      body: { planId: plan.id, tenantId, force: true },
    });
    setRunning(null);
    if (error) { toast.error(error.message); return; }
    const res = (data as any)?.results?.[0];
    toast[res?.document ? 'success' : 'info'](
      res?.document ? `Sammelrechnung ${res.document} erstellt` : res?.skipped ?? 'Nichts abzurechnen',
    );
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('cmr_collective_plans' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const toggleProject = (id: string) => {
    const cur_ = new Set<string>(dlg.project_ids ?? []);
    cur_.has(id) ? cur_.delete(id) : cur_.add(id);
    setDlg({ ...dlg, project_ids: [...cur_] });
  };

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {!canWrite && <CmrReadOnlyBanner />}
      <PageHeader
        title="CMR Sammelabrechnung"
        subtitle="Wiederkehrende Sammelrechnungen ohne Abo – gebündelte Projektleistungen je Kunde."
        actions={<Button onClick={newPlan} disabled={!canWrite}><Plus className="w-4 h-4 mr-1.5" /> Plan anlegen</Button>}
      />

      <Card className="divide-y">
        {plans.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Repeat className="w-5 h-5" /> Noch keine Sammelabrechnung angelegt.
          </div>
        )}
        {plans.map((p) => (
          <div key={p.id} className="p-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">
                {p.name} <span className="text-muted-foreground font-normal">· {p.customer_name ?? 'Alle Kunden'}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {INTERVALS.find((i) => i.value === p.interval_unit)?.label ?? p.interval_unit}
                {' · nächster Lauf '}{new Date(p.next_run_date).toLocaleDateString('de-DE')}
                {p.project_ids?.length ? ` · ${p.project_ids.length} Projekt(e)` : ' · alle Projekte'}
                {p.last_run_at ? ` · zuletzt ${new Date(p.last_run_at).toLocaleDateString('de-DE')}` : ''}
              </div>
            </div>
            <Badge variant="outline" className={p.is_active ? 'border-emerald-500/40 text-emerald-500' : ''}>
              {p.is_active ? 'aktiv' : 'pausiert'}
            </Badge>
            <div className="text-sm tabular-nums">
              offen: {cmrMoney(openByCustomer.get(p.customer_id ?? '—') ?? 0, p.currency || cur)}
            </div>
            <Button size="sm" variant="outline" disabled={!canWrite || running === p.id} onClick={() => runNow(p)}>
              {running === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" disabled={!canWrite} onClick={() => setDlg({ ...p })}>Bearbeiten</Button>
            <Button size="sm" variant="ghost" disabled={!canWrite} onClick={() => remove(p.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{dlg?.id ? 'Sammelabrechnung bearbeiten' : 'Sammelabrechnung anlegen'}</DialogTitle></DialogHeader>
          {dlg && (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={dlg.name} onChange={(e) => setDlg({ ...dlg, name: e.target.value })} /></div>
                <div>
                  <Label>Kunde (aus Projekten)</Label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={dlg.customer_id ?? ''}
                    onChange={(e) => {
                      const proj = projects.find((p) => p.customer_id === e.target.value);
                      setDlg({ ...dlg, customer_id: e.target.value, customer_name: proj?.customer_name ?? '' });
                    }}
                  >
                    <option value="">Alle Kunden</option>
                    {[...new Map(projects.filter((p) => p.customer_id).map((p) => [p.customer_id, p])).values()]
                      .map((p: any) => <option key={p.customer_id} value={p.customer_id}>{p.customer_name}</option>)}
                  </select>
                </div>
                <div><Label>E-Mail (für Auto-Versand)</Label><Input value={dlg.customer_email ?? ''} onChange={(e) => setDlg({ ...dlg, customer_email: e.target.value })} /></div>
                <div>
                  <Label>Intervall</Label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={dlg.interval_unit} onChange={(e) => setDlg({ ...dlg, interval_unit: e.target.value })}
                  >
                    {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
                <div><Label>Nächster Lauf</Label><Input type="date" value={dlg.next_run_date} onChange={(e) => setDlg({ ...dlg, next_run_date: e.target.value })} /></div>
                <div><Label>MwSt. (%)</Label><Input type="number" step="0.01" value={dlg.tax_rate} onChange={(e) => setDlg({ ...dlg, tax_rate: e.target.value })} /></div>
                <div><Label>Mindestbetrag ({cur})</Label><Input type="number" step="0.01" value={dlg.min_amount} onChange={(e) => setDlg({ ...dlg, min_amount: e.target.value })} /></div>
              </div>

              <div>
                <Label>Projekte (leer = alle Projekte des Kunden)</Label>
                <div className="mt-1 rounded-md border p-2 max-h-40 overflow-y-auto space-y-1">
                  {projects
                    .filter((p) => !dlg.customer_id || p.customer_id === dlg.customer_id)
                    .map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox" className="h-4 w-4"
                          checked={(dlg.project_ids ?? []).includes(p.id)}
                          onChange={() => toggleProject(p.id)}
                        />
                        {p.code ? `${p.code} · ` : ''}{p.name}
                      </label>
                    ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={!!dlg.auto_send} onChange={(e) => setDlg({ ...dlg, auto_send: e.target.checked })} />
                  Rechnung automatisch per E-Mail versenden
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={!!dlg.is_active} onChange={(e) => setDlg({ ...dlg, is_active: e.target.checked })} />
                  aktiv
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving || !canWrite}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
