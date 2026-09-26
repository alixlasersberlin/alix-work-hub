import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Play, ShieldCheck, Send, Landmark, RefreshCw, Plus, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';

const db = supabase as any;
const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
const dt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');
const CONFIRM = 'Ich habe den Monatslauf geprüft und möchte die ausgewählten Rechnungen erzeugen.';
const nextPeriod = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const periodLabel = (p: string) => new Date(p + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

const RUN_STATUS: Record<string, { l: string; c: string }> = {
  preview: { l: 'PREVIEW – NOCH NICHT FREIGEGEBEN', c: 'bg-muted text-muted-foreground' },
  geprueft: { l: 'GEPRÜFT', c: 'bg-sky-500/15 text-sky-500' },
  freigegeben: { l: 'FREIGEGEBEN', c: 'bg-sky-500/15 text-sky-500' },
  rechnungen_erzeugt: { l: 'RECHNUNGEN ERZEUGT', c: 'bg-sky-500/15 text-sky-500' },
  prenotification_versendet: { l: 'VORABINFO VERSENDET', c: 'bg-sky-500/15 text-sky-500' },
  bereit_fuer_einzug: { l: 'BEREIT FÜR EINZUG', c: 'bg-emerald-500/15 text-emerald-500' },
  bezahlt: { l: 'BEZAHLT', c: 'bg-emerald-500/15 text-emerald-500' },
  teilweise_bezahlt: { l: 'TEILWEISE BEZAHLT', c: 'bg-amber-500/15 text-amber-500' },
  ruecklastschrift: { l: 'RÜCKLASTSCHRIFT', c: 'bg-red-500/15 text-red-500' },
  fehler: { l: 'FEHLER', c: 'bg-red-500/15 text-red-500' },
};
const ITEM_STATUS: Record<string, { l: string; c: string }> = {
  ready: { l: 'Bereit', c: 'bg-emerald-500/15 text-emerald-500' },
  warning: { l: 'Warnung', c: 'bg-amber-500/15 text-amber-500' },
  blocker: { l: 'Blocker', c: 'bg-red-500/15 text-red-500' },
  removed: { l: 'Entfernt', c: 'bg-muted text-muted-foreground' },
  skipped: { l: 'Ausgesetzt', c: 'bg-muted text-muted-foreground' },
  invoiced: { l: 'Rechnung erzeugt', c: 'bg-sky-500/15 text-sky-500' },
  prenotified: { l: 'Vorabinfo übergeben', c: 'bg-sky-500/15 text-sky-500' },
  ready_for_debit: { l: 'Bereit für Einzug', c: 'bg-emerald-500/15 text-emerald-500' },
  paid: { l: 'Bezahlt', c: 'bg-emerald-500/15 text-emerald-500' },
  partially_paid: { l: 'Teilweise bezahlt', c: 'bg-amber-500/15 text-amber-500' },
  return_debit: { l: 'Rücklastschrift', c: 'bg-red-500/15 text-red-500' },
  error: { l: 'Fehler', c: 'bg-red-500/15 text-red-500' },
};
const Pill = ({ m, k }: { m: Record<string, { l: string; c: string }>; k: string }) => (
  <Badge variant="outline" className={m[k]?.c}>{m[k]?.l ?? k}</Badge>
);

async function rpc(name: string, args: any) {
  const { data, error } = await db.rpc(name, args);
  if (error) { toast.error(error.message); throw error; }
  return data;
}

export default function SepaMonatslauf() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'uebersicht';
  const setTab = (t: string) => setSp({ tab: t });
  return (
    <div className="space-y-4">
      <PageHeader title="Wiederkehrende Zahler · SEPA-Monatslauf" description="Vorschau → Prüfung → Freigabe → Rechnungen → Vorabinformation → Einzug. Kein automatischer Bankeinzug." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {[['uebersicht', 'Übersicht'], ['zahler', 'Aktive Zahler'], ['laeufe', 'Monatsläufe'], ['mandate', 'SEPA-Mandate'], ['vorab', 'Vorabinformationen'], ['ruecklast', 'Rücklastschriften'], ['einstellungen', 'Einstellungen'], ['protokoll', 'Protokoll']].map(([k, l]) => (
            <TabsTrigger key={k} value={k}>{l}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === 'uebersicht' && <Overview />}
      {tab === 'zahler' && <Plans />}
      {tab === 'laeufe' && <Runs />}
      {tab === 'mandate' && <Mandates />}
      {tab === 'vorab' && <Prenotifications />}
      {tab === 'ruecklast' && <ReturnDebits />}
      {tab === 'einstellungen' && <Settings />}
      {tab === 'protokoll' && <AuditLog />}
    </div>
  );
}

/* ---------------- Übersicht ---------------- */
function Overview() {
  const [k, setK] = useState<any>(null);
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const period = nextPeriod();
    const [plans, mands, pns, rds, r] = await Promise.all([
      db.from('rp_payment_plans').select('id', { count: 'exact', head: true }).eq('status', 'aktiv'),
      db.rpc('rp_list_mandates'),
      db.from('rp_prenotifications').select('id', { count: 'exact', head: true }).eq('status', 'erstellt'),
      db.from('rp_return_debits').select('id', { count: 'exact', head: true }).neq('status', 'geklaert'),
      db.from('rp_billing_runs').select('*').eq('billing_period', period).maybeSingle(),
    ]);
    let items: any[] = [];
    if (r.data) items = (await db.from('rp_billing_run_items').select('status,gross_amount').eq('run_id', r.data.id)).data || [];
    setRun(r.data ? { ...r.data, items } : { billing_period: period, items: [] });
    setK({ plans: plans.count || 0, badMand: (mands.data || []).filter((m: any) => m.status !== 'aktiv').length, pns: pns.count || 0, rds: rds.count || 0 });
  }
  useEffect(() => { load(); }, []);
  if (!k) return <Loader2 className="w-5 h-5 animate-spin" />;
  const act = run.items.filter((i: any) => !['removed', 'skipped'].includes(i.status));
  const blockers = act.filter((i: any) => i.status === 'blocker').length;
  const sum = act.filter((i: any) => i.status !== 'blocker').reduce((s: number, i: any) => s + Number(i.gross_amount), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[['Aktive Zahler', k.plans], ['Nächster Monatslauf', periodLabel(run.billing_period)], ['Geplanter Einzug', eur(sum)], ['Fehlerhafte Mandate', k.badMand], ['Offene Vorabinfos', k.pns], ['Rücklastschriften', k.rds]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-semibold mt-1">{v}</div></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Monatslauf {periodLabel(run.billing_period)}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {run.id ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <span>{act.length} Zahler</span><span>{act.length - blockers} bereit</span><span className={blockers ? 'text-red-500' : ''}>{blockers} fehlerhaft</span>
              <span className="font-semibold">Gesamt {eur(sum)}</span><Pill m={RUN_STATUS} k={run.status} />
            </div>
          ) : <p className="text-sm text-muted-foreground">Noch nicht vorbereitet. Wird am 1. jedes Monats automatisch als Vorschau angelegt.</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); try { await rpc('rp_prepare_run', { p_period: run.billing_period }); toast.success('Monatslauf vorbereitet (Vorschau)'); await load(); } finally { setBusy(false); } }}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />} Monatslauf vorbereiten
            </Button>
            {run.id && <Button size="sm" variant="outline" onClick={() => window.location.assign(`/finance/sepa-monatslauf?tab=laeufe&run=${run.id}`)}><Eye className="w-4 h-4 mr-1" /> Preview öffnen</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Monatsläufe + Preview ---------------- */
function Runs() {
  const [sp, setSp] = useSearchParams();
  const runId = sp.get('run');
  const [runs, setRuns] = useState<any[]>([]);
  const [period, setPeriod] = useState(nextPeriod());
  useEffect(() => { db.from('rp_billing_runs').select('*').order('billing_period', { ascending: false }).then((r: any) => setRuns(r.data || [])); }, [runId]);
  if (runId) return <RunDetail runId={runId} onBack={() => setSp({ tab: 'laeufe' })} />;
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex gap-2 items-end">
        <div><Label className="text-xs">Periode</Label><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44" /></div>
        <Button size="sm" onClick={async () => { const id = await rpc('rp_prepare_run', { p_period: period }); setSp({ tab: 'laeufe', run: id }); }}><Play className="w-4 h-4 mr-1" /> Vorbereiten</Button>
      </div>
      <table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr><th className="py-2">Periode</th><th>Status</th><th>Vorbereitet</th><th>Freigegeben</th><th /></tr></thead>
        <tbody>{runs.map((r) => (
          <tr key={r.id} className="border-t border-border"><td className="py-2">{periodLabel(r.billing_period)}</td><td><Pill m={RUN_STATUS} k={r.status} /></td><td>{dt(r.prepared_at)}</td><td>{dt(r.approved_at)}</td>
            <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setSp({ tab: 'laeufe', run: r.id })}>Öffnen</Button></td></tr>
        ))}{!runs.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Noch keine Monatsläufe</td></tr>}</tbody></table>
    </CardContent></Card>
  );
}

function RunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const [run, setRun] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState('alle');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [actDlg, setActDlg] = useState<{ action: string; label: string } | null>(null);
  const [actVal, setActVal] = useState('');
  const [actReason, setActReason] = useState('');
  const [detail, setDetail] = useState<any>(null);

  async function load() {
    const [r, it] = await Promise.all([db.from('rp_billing_runs').select('*').eq('id', runId).single(), db.from('rp_billing_run_items').select('*').eq('run_id', runId)]);
    setRun(r.data); const list = it.data || []; setItems(list);
    const cids = [...new Set(list.map((i: any) => i.customer_id))];
    const pids = [...new Set(list.map((i: any) => i.plan_id))];
    const [cs, ps, ms, pns] = await Promise.all([
      cids.length ? db.from('customers').select('id,company_name,contact_name,external_customer_id,email,phone').in('id', cids) : { data: [] },
      pids.length ? db.from('rp_payment_plans').select('id,product,payment_method,notify_channel,email,phone').in('id', pids) : { data: [] },
      db.rpc('rp_list_mandates'),
      db.from('rp_prenotifications').select('id,item_id,status').in('item_id', list.map((i: any) => i.id).concat(['00000000-0000-0000-0000-000000000000'])),
    ]);
    const m: Record<string, any> = {};
    (cs.data || []).forEach((c: any) => (m['c' + c.id] = c)); (ps.data || []).forEach((p: any) => (m['p' + p.id] = p));
    (ms.data || []).forEach((x: any) => (m['m' + x.id] = x)); (pns.data || []).forEach((x: any) => (m['n' + x.item_id] = x));
    setMeta(m); setSel(new Set());
  }
  useEffect(() => { load(); }, [runId]);

  const editable = run && ['preview', 'geprueft'].includes(run.status);
  const active = items.filter((i) => !['removed', 'skipped'].includes(i.status));
  const blockers = active.filter((i) => i.status === 'blocker').length;
  const warnings = active.filter((i) => i.status === 'warning').length;
  const billable = active.filter((i) => ['ready', 'warning'].includes(i.status));
  const total = billable.reduce((s, i) => s + Number(i.gross_amount), 0);
  const emails = billable.filter((i) => ['email', 'email_sms'].includes(meta['p' + i.plan_id]?.notify_channel)).length;
  const sms = billable.filter((i) => ['sms', 'email_sms'].includes(meta['p' + i.plan_id]?.notify_channel)).length;
  const sepa = billable.filter((i) => meta['p' + i.plan_id]?.payment_method === 'sepa').length;

  const rows = useMemo(() => items.filter((i) => {
    const f = filter === 'alle' ? true : filter === 'bereit' ? i.status === 'ready' : filter === 'warnungen' ? i.status === 'warning' : filter === 'blocker' ? i.status === 'blocker' : filter === 'ausgesetzt' ? ['skipped', 'removed'].includes(i.status) : filter === 'zahlungen' ? ['paid', 'partially_paid', 'return_debit', 'ready_for_debit'].includes(i.status) : filter === 'benachrichtigungen' ? !!meta['n' + i.id] : true;
    const c = meta['c' + i.customer_id];
    const s = `${c?.company_name || ''} ${c?.contact_name || ''} ${c?.external_customer_id || ''}`.toLowerCase();
    return f && (!q || s.includes(q.toLowerCase()));
  }), [items, filter, q, meta]);

  async function doAction(action: string, value?: string, reason?: string) {
    setBusy(true);
    try { const n = await rpc('rp_item_action', { p_item_ids: [...sel], p_action: action, p_value: value ?? null, p_reason: reason ?? null }); toast.success(`${n} Position(en) aktualisiert`); await load(); } finally { setBusy(false); }
  }
  async function approve() {
    setBusy(true);
    try {
      const r = await rpc('rp_approve_run', { p_run_id: runId, p_confirmation: CONFIRM, p_idempotency_key: `ui-${runId}` });
      toast.success(r?.already ? 'Lauf war bereits freigegeben – keine neuen Rechnungen' : `${r.invoices} Rechnungen erzeugt · ${eur(r.total)}`);
      setApproveOpen(false); await load();
    } finally { setBusy(false); }
  }
  async function sendPn() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('rp-send-prenotifications', { body: { run_id: runId } });
      if (error || data?.error) { toast.error(data?.error || error?.message); return; }
      toast.success(`${data.handed_over} übergeben · ${data.failed} fehlgeschlagen · ${data.skipped} bereits versendet`);
      if (data.errors?.length) toast.error(data.errors.slice(0, 3).join('\n'));
      await load();
    } finally { setBusy(false); }
  }
  async function resendSelected() {
    const ids = [...sel].map((i) => meta['n' + i]?.id).filter(Boolean);
    if (!ids.length) return toast.error('Keine Vorabinformation in der Auswahl');
    const { data } = await supabase.functions.invoke('rp-send-prenotifications', { body: { run_id: runId, resend_ids: ids } });
    toast.success(`Erneut gesendet: ${data?.handed_over ?? 0}`); await load();
  }
  async function exportCsv() {
    const head = ['Status', 'Kunde', 'Kundennr', 'Leistung', 'Brutto', 'MwSt', 'Fällig', 'IBAN', 'Mandat', 'Warnungen'];
    const lines = rows.map((i) => { const c = meta['c' + i.customer_id]; const m = meta['m' + i.mandate_id]; return [ITEM_STATUS[i.status]?.l, c?.company_name || c?.contact_name, c?.external_customer_id, meta['p' + i.plan_id]?.product, i.gross_amount, i.tax_amount, i.due_date, m?.iban_masked, m?.mandate_reference, (i.issues || []).map((x: any) => x.msg).join('; ')]; });
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = `monatslauf-${run.billing_period}.csv`; a.click();
  }

  if (!run) return <Loader2 className="w-5 h-5 animate-spin" />;
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="ghost" onClick={onBack}>← Zurück</Button>
          <h2 className="text-lg font-semibold">Monatslauf {periodLabel(run.billing_period)}</h2><Pill m={RUN_STATUS} k={run.status} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>{billable.length} Zahler</span><span className="font-semibold">{eur(total)} Gesamt</span><span>{emails} E-Mails</span><span>{sms} SMS</span>
          <span className={warnings ? 'text-amber-500' : ''}>{warnings} Warnungen</span><span className={blockers ? 'text-red-500 font-semibold' : ''}>{blockers} Blocker</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { await rpc('rp_prepare_run', { p_period: run.billing_period }); await load(); }}><RefreshCw className="w-4 h-4 mr-1" /> Neu einlesen</Button>}
          {editable && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { const r = await rpc('rp_validate_run', { p_run_id: runId }); toast.success(`Geprüft: ${r.ready} bereit, ${r.warning} Warnungen, ${r.blocker} Blocker`); await load(); }}><ShieldCheck className="w-4 h-4 mr-1" /> Fehler prüfen</Button>}
          {editable && <Button size="sm" disabled={busy || blockers > 0 || !billable.length} onClick={() => { setStep(1); setConfirmed(false); setApproveOpen(true); }}>Lauf freigeben</Button>}
          {['rechnungen_erzeugt', 'prenotification_versendet'].includes(run.status) && <Button size="sm" disabled={busy} onClick={sendPn}><Send className="w-4 h-4 mr-1" /> Vorabinformationen senden</Button>}
          {['rechnungen_erzeugt', 'prenotification_versendet'].includes(run.status) && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { const r = await rpc('rp_prepare_direct_debit', { p_run_id: runId }); toast.success(`${r.items} Positionen bereit für Einzug (kein Bankeinzug ausgelöst)`); await load(); }}><Landmark className="w-4 h-4 mr-1" /> Einzug vorbereiten</Button>}
          {!editable && <Button size="sm" variant="outline" onClick={async () => { const n = await rpc('rp_sync_payments', { p_run_id: runId }); toast.success(`${n} Zahlungsstatus aktualisiert`); await load(); }}><RefreshCw className="w-4 h-4 mr-1" /> Zahlungen abgleichen</Button>}
          <Button size="sm" variant="ghost" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
        </div>
        {blockers > 0 && editable && <p className="text-xs text-red-500">Freigabe gesperrt, solange Blocker vorhanden sind. Blocker beheben oder Positionen aus dem Lauf entfernen.</p>}
      </CardContent></Card>

      <div className="flex flex-wrap gap-2 items-center">
        <Tabs value={filter} onValueChange={setFilter}><TabsList className="flex-wrap h-auto">
          {['alle', 'bereit', 'warnungen', 'blocker', 'ausgesetzt', 'benachrichtigungen', 'zahlungen'].map((f) => <TabsTrigger key={f} value={f} className="capitalize">{f}</TabsTrigger>)}
        </TabsList></Tabs>
        <Input placeholder="Kunde suchen…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
      </div>

      {sel.size > 0 && (
        <div className="flex flex-wrap gap-2 items-center p-2 rounded-md border border-border bg-muted/40 text-sm">
          <span>{sel.size} markiert</span>
          {editable && <>
            <Button size="sm" variant="outline" onClick={() => setActDlg({ action: 'remove', label: 'Aus Lauf entfernen' })}>Aus Lauf entfernen</Button>
            <Button size="sm" variant="outline" onClick={() => setActDlg({ action: 'skip_month', label: 'Diesen Monat aussetzen' })}>Diesen Monat aussetzen</Button>
            <Button size="sm" variant="outline" onClick={() => setActDlg({ action: 'set_due', label: 'Fälligkeit ändern' })}>Fälligkeit ändern</Button>
            <Button size="sm" variant="outline" onClick={() => setActDlg({ action: 'set_amount', label: 'Betrag einmalig ändern (brutto)' })}>Betrag einmalig ändern</Button>
            <Button size="sm" variant="outline" onClick={() => doAction('restore')}>Wiederherstellen</Button>
            <Button size="sm" variant="outline" onClick={() => doAction('revalidate')}>Fehler prüfen</Button>
          </>}
          {!editable && <Button size="sm" variant="outline" onClick={resendSelected}>Vorabinfo erneut senden</Button>}
        </div>
      )}

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground text-xs"><tr className="border-b border-border">
            <th className="p-2"><Checkbox checked={rows.length > 0 && rows.every((r) => sel.has(r.id))} onCheckedChange={(v) => setSel(v ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
            <th>Status</th><th>Kunde</th><th>Kd-Nr.</th><th>Leistung</th><th className="text-right">Betrag</th><th className="text-right">MwSt.</th><th>Fällig</th><th>Zahlungsart</th><th>IBAN</th><th>Kontoinhaber</th><th>Mandat</th><th>Mandatsstatus</th><th>Vorabinfo</th><th>E-Mail</th><th>SMS</th><th>Warnungen</th>
          </tr></thead>
          <tbody>{rows.map((i) => {
            const c = meta['c' + i.customer_id]; const p = meta['p' + i.plan_id]; const m = meta['m' + i.mandate_id]; const n = meta['n' + i.id];
            return (
              <tr key={i.id} className="border-b border-border hover:bg-muted/30 cursor-pointer" onClick={() => setDetail({ i, c, p, m, n })}>
                <td className="p-2" onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.has(i.id)} onCheckedChange={(v) => { const s = new Set(sel); v ? s.add(i.id) : s.delete(i.id); setSel(s); }} /></td>
                <td><Pill m={ITEM_STATUS} k={i.status} /></td>
                <td className="font-medium">{c?.company_name || c?.contact_name}</td><td>{c?.external_customer_id}</td><td>{p?.product}</td>
                <td className="text-right">{eur(i.gross_amount)}{i.amount_overridden && <span className="text-amber-500"> *</span>}</td><td className="text-right">{eur(i.tax_amount)}</td>
                <td>{dt(i.due_date)}</td><td>{p?.payment_method === 'sepa' ? 'SEPA' : 'Überweisung'}</td><td className="font-mono text-xs">{m?.iban_masked || '—'}</td><td>{m?.account_holder || '—'}</td>
                <td>{m?.mandate_reference || '—'}</td><td>{m?.status || '—'}</td><td>{n?.status || '—'}</td>
                <td>{['email', 'email_sms'].includes(p?.notify_channel) ? (p?.email || c?.email || '—') : '—'}</td>
                <td>{['sms', 'email_sms'].includes(p?.notify_channel) ? (p?.phone || c?.phone || '—') : '—'}</td>
                <td className="text-xs max-w-[280px]">{(i.issues || []).map((x: any, k: number) => <div key={k} className={x.level === 'BLOCKER' ? 'text-red-500' : x.level === 'WARNUNG' ? 'text-amber-500' : 'text-muted-foreground'}>{x.level}: {x.msg}</div>)}</td>
              </tr>);
          })}{!rows.length && <tr><td colSpan={17} className="p-6 text-center text-muted-foreground">Keine Positionen</td></tr>}</tbody>
        </table>
      </CardContent></Card>

      <Dialog open={!!actDlg} onOpenChange={(o) => !o && setActDlg(null)}>
        <DialogContent><DialogHeader><DialogTitle>{actDlg?.label} ({sel.size})</DialogTitle></DialogHeader>
          {actDlg?.action === 'set_due' && <Input type="date" value={actVal} onChange={(e) => setActVal(e.target.value)} />}
          {actDlg?.action === 'set_amount' && <Input type="number" step="0.01" placeholder="Bruttobetrag" value={actVal} onChange={(e) => setActVal(e.target.value)} />}
          <Textarea placeholder="Grund (wird protokolliert)" value={actReason} onChange={(e) => setActReason(e.target.value)} />
          <DialogFooter><Button disabled={busy || (['set_due', 'set_amount'].includes(actDlg?.action || '') && !actVal)} onClick={async () => { await doAction(actDlg!.action, actVal, actReason); setActDlg(null); setActVal(''); setActReason(''); }}>Übernehmen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Monatslauf freigeben – Schritt {step} von 4</DialogTitle></DialogHeader>
          {step === 1 && <p className="text-sm">Bitte prüfen Sie die Vorschau-Tabelle vollständig (Beträge, Fälligkeiten, Mandate).</p>}
          {step === 2 && <p className="text-sm">Die Validierung wird beim Freigeben serverseitig erneut ausgeführt. Aktuell: <b>{blockers} Blocker</b>, {warnings} Warnungen.</p>}
          {step === 3 && <div className="text-sm grid grid-cols-2 gap-1">
            <span>Rechnungen</span><b>{billable.length}</b><span>Gesamtbetrag</span><b>{eur(total)}</b><span>SEPA-Zahlungen</span><b>{sepa}</b><span>E-Mails</span><b>{emails}</b><span>zusätzliche SMS</span><b>{sms}</b><span>Blocker</span><b>{blockers}</b><span>Warnungen</span><b>{warnings}</b>
          </div>}
          {step === 4 && <label className="flex gap-2 text-sm items-start"><Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} /> „{CONFIRM}"</label>}
          <DialogFooter>
            {step > 1 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Zurück</Button>}
            {step < 4 ? <Button onClick={() => setStep(step + 1)}>Weiter</Button>
              : <Button disabled={!confirmed || busy || blockers > 0} onClick={approve}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} MONATSLAUF FREIGEBEN</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{detail?.c?.company_name || detail?.c?.contact_name}</DialogTitle></DialogHeader>
          {detail && <div className="text-sm space-y-1">
            <div>Leistung: {detail.p?.product} · {eur(detail.i.gross_amount)} (Original {eur(detail.i.original_gross_amount)})</div>
            <div>Fällig: {dt(detail.i.due_date)} · Periode {detail.i.billing_period}</div>
            <div>Mandat: {detail.m?.mandate_reference || '—'} · {detail.m?.status || '—'}</div>
            <IbanReveal mandateId={detail.i.mandate_id} masked={detail.m?.iban_masked} />
            <div className="pt-2">{(detail.i.issues || []).map((x: any, k: number) => <div key={k}>{x.level}: {x.msg}</div>)}</div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IbanReveal({ mandateId, masked }: { mandateId?: string; masked?: string }) {
  const [full, setFull] = useState<string | null>(null);
  if (!mandateId) return null;
  return <div>IBAN: <span className="font-mono">{full || masked}</span> {!full && <Button size="sm" variant="link" onClick={async () => { const { data, error } = await db.rpc('rp_get_mandate_iban', { p_mandate_id: mandateId }); if (error) toast.error('Keine Berechtigung für Bankdaten'); else setFull(data); }}>vollständig anzeigen</Button>}</div>;
}

/* ---------------- Aktive Zahler ---------------- */
function CustomerPicker({ value, onChange }: { value: string; onChange: (id: string, c: any) => void }) {
  const [q, setQ] = useState(''); const [list, setList] = useState<any[]>([]);
  useEffect(() => { if (q.length < 2) { setList([]); return; } const t = setTimeout(async () => { const e = q.replace(/[%,()]/g, ''); const { data } = await db.from('customers').select('id,company_name,contact_name,email,phone,external_customer_id').or(`company_name.ilike.%${e}%,contact_name.ilike.%${e}%,external_customer_id.ilike.%${e}%`).limit(10); setList(data || []); }, 250); return () => clearTimeout(t); }, [q]);
  return <div className="space-y-1"><Input placeholder="Kunde suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
    {list.map((c) => <div key={c.id} className={`text-sm px-2 py-1 rounded cursor-pointer hover:bg-muted ${value === c.id ? 'bg-muted' : ''}`} onClick={() => { onChange(c.id, c); setQ(c.company_name || c.contact_name); setList([]); }}>{c.company_name || c.contact_name} <span className="text-muted-foreground">{c.external_customer_id}</span></div>)}</div>;
}

function Plans() {
  const [rows, setRows] = useState<any[]>([]); const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false); const [f, setF] = useState<any>({}); const [mands, setMands] = useState<any[]>([]);
  const [q, setQ] = useState('');
  async function load() {
    const { data } = await db.from('rp_payment_plans').select('*').order('created_at', { ascending: false });
    setRows(data || []); const ids = [...new Set((data || []).map((r: any) => r.customer_id))];
    if (ids.length) { const { data: cs } = await db.from('customers').select('id,company_name,contact_name').in('id', ids); const m: any = {}; (cs || []).forEach((c: any) => (m[c.id] = c.company_name || c.contact_name)); setNames(m); }
    const { data: ms } = await db.rpc('rp_list_mandates'); setMands(ms || []);
  }
  useEffect(() => { load(); }, []);
  async function save() {
    const months = { monatlich: 1, quartalsweise: 3, halbjaehrlich: 6, jaehrlich: 12 } as any;
    const payload = { customer_id: f.customer_id, product: f.product, description: f.description || null, net_amount: Number(f.net_amount), tax_rate: Number(f.tax_rate ?? 19), billing_interval: f.billing_interval || 'monatlich', interval_months: months[f.billing_interval || 'monatlich'] || Number(f.interval_months || 1), start_date: f.start_date, end_date: f.end_date || null, due_day: Number(f.due_day || 1), payment_method: f.payment_method || 'sepa', mandate_id: f.mandate_id || null, notify_channel: f.notify_channel || 'email', email: f.email || null, phone: f.phone || null, cost_center: f.cost_center || null, booking_account: f.booking_account || null };
    const { error } = f.id ? await db.from('rp_payment_plans').update(payload).eq('id', f.id) : await db.from('rp_payment_plans').insert(payload);
    if (error) return toast.error(error.message); toast.success('Gespeichert'); setOpen(false); load();
  }
  async function setStatus(id: string, status: string) { const { error } = await db.from('rp_payment_plans').update({ status }).eq('id', id); if (error) toast.error(error.message); else load(); }
  const vis = rows.filter((r) => !q || (names[r.customer_id] || '').toLowerCase().includes(q.toLowerCase()) || r.product.toLowerCase().includes(q.toLowerCase()));
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex gap-2"><Input placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" /><Button size="sm" onClick={() => { setF({ tax_rate: 19, billing_interval: 'monatlich', due_day: 1, payment_method: 'sepa', notify_channel: 'email' }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Zahlungsplan anlegen</Button></div>
      <table className="w-full text-sm"><thead className="text-left text-muted-foreground text-xs"><tr><th className="py-2">Kunde</th><th>Leistung</th><th className="text-right">Netto</th><th className="text-right">Brutto</th><th>Intervall</th><th>Start</th><th>Ende</th><th>Fällig am</th><th>Zahlungsart</th><th>Status</th><th /></tr></thead>
        <tbody>{vis.map((r) => (
          <tr key={r.id} className="border-t border-border"><td className="py-2">{names[r.customer_id]}</td><td>{r.product}</td><td className="text-right">{eur(r.net_amount)}</td><td className="text-right">{eur(r.gross_amount)}</td><td>{r.billing_interval}</td><td>{dt(r.start_date)}</td><td>{dt(r.end_date)}</td><td>{r.due_day}.</td><td>{r.payment_method === 'sepa' ? 'SEPA' : 'Überweisung'}</td>
            <td><Badge variant="outline" className={r.status === 'aktiv' ? 'bg-emerald-500/15 text-emerald-500' : r.status === 'fehler' ? 'bg-red-500/15 text-red-500' : 'bg-muted text-muted-foreground'}>{r.status.toUpperCase()}</Badge></td>
            <td className="text-right whitespace-nowrap">
              <Button size="sm" variant="ghost" onClick={() => { setF(r); setOpen(true); }}>Bearbeiten</Button>
              {r.status === 'aktiv' ? <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'pausiert')}>Pausieren</Button> : r.status === 'pausiert' ? <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, 'aktiv')}>Aktivieren</Button> : null}
            </td></tr>))}
          {!vis.length && <tr><td colSpan={11} className="py-6 text-center text-muted-foreground">Noch keine Zahlungspläne</td></tr>}</tbody></table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{f.id ? 'Zahlungsplan bearbeiten' : 'Zahlungsplan anlegen'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Kunde</Label>{f.id ? <div className="text-sm">{names[f.customer_id]}</div> : <CustomerPicker value={f.customer_id} onChange={(id, c) => setF((x: any) => ({ ...x, customer_id: id, email: x.email || c.email, phone: x.phone || c.phone }))} />}</div>
            <div><Label className="text-xs">Leistung / Produkt</Label><Input value={f.product || ''} onChange={(e) => set('product', e.target.value)} /></div>
            <div><Label className="text-xs">Beschreibung</Label><Input value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></div>
            <div><Label className="text-xs">Nettobetrag</Label><Input type="number" step="0.01" value={f.net_amount ?? ''} onChange={(e) => set('net_amount', e.target.value)} /></div>
            <div><Label className="text-xs">MwSt. %</Label><Input type="number" value={f.tax_rate ?? 19} onChange={(e) => set('tax_rate', e.target.value)} /></div>
            <div><Label className="text-xs">Intervall</Label><Select value={f.billing_interval || 'monatlich'} onValueChange={(v) => set('billing_interval', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['monatlich', 'quartalsweise', 'halbjaehrlich', 'jaehrlich', 'individuell'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            {f.billing_interval === 'individuell' && <div><Label className="text-xs">alle … Monate</Label><Input type="number" value={f.interval_months || 1} onChange={(e) => set('interval_months', e.target.value)} /></div>}
            <div><Label className="text-xs">Fälligkeitstag (1–28)</Label><Input type="number" min={1} max={28} value={f.due_day || 1} onChange={(e) => set('due_day', e.target.value)} /></div>
            <div><Label className="text-xs">Startdatum</Label><Input type="date" value={f.start_date || ''} onChange={(e) => set('start_date', e.target.value)} /></div>
            <div><Label className="text-xs">Enddatum (optional)</Label><Input type="date" value={f.end_date || ''} onChange={(e) => set('end_date', e.target.value)} /></div>
            <div><Label className="text-xs">Zahlungsart</Label><Select value={f.payment_method || 'sepa'} onValueChange={(v) => set('payment_method', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sepa">SEPA-Lastschrift</SelectItem><SelectItem value="ueberweisung">Überweisung</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">SEPA-Mandat</Label><Select value={f.mandate_id || 'none'} onValueChange={(v) => set('mandate_id', v === 'none' ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">— kein Mandat —</SelectItem>{mands.filter((m) => m.customer_id === f.customer_id).map((m) => <SelectItem key={m.id} value={m.id}>{m.mandate_reference} · {m.iban_masked}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Benachrichtigung</Label><Select value={f.notify_channel || 'email'} onValueChange={(v) => set('notify_channel', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">E-Mail</SelectItem><SelectItem value="sms">SMS</SelectItem><SelectItem value="email_sms">E-Mail + SMS</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">E-Mail</Label><Input value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
            <div><Label className="text-xs">Mobilnummer</Label><Input value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
            <div><Label className="text-xs">Kostenstelle</Label><Input value={f.cost_center || ''} onChange={(e) => set('cost_center', e.target.value)} /></div>
            <div><Label className="text-xs">Buchungskonto</Label><Input value={f.booking_account || ''} onChange={(e) => set('booking_account', e.target.value)} /></div>
          </div>
          <DialogFooter><Button disabled={!f.customer_id || !f.product || !f.net_amount || !f.start_date} onClick={save}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent></Card>
  );
}

/* ---------------- Mandate ---------------- */
function Mandates() {
  const [rows, setRows] = useState<any[]>([]); const [open, setOpen] = useState(false); const [f, setF] = useState<any>({});
  const load = async () => { const { data, error } = await db.rpc('rp_list_mandates'); if (error) toast.error(error.message); setRows(data || []); };
  useEffect(() => { load(); }, []);
  async function save() {
    const iban = String(f.iban || '').replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return toast.error('IBAN ungültig');
    const { error } = await db.from('rp_mandates').insert({ customer_id: f.customer_id, mandate_reference: f.mandate_reference, mandate_date: f.mandate_date || null, account_holder: f.account_holder, iban, bic: f.bic || null, sequence_type: 'RCUR' });
    if (error) return toast.error(error.message); toast.success('Mandat angelegt'); setOpen(false); load();
  }
  async function setStatus(id: string, status: string) { const { error } = await db.from('rp_mandates').update({ status }).eq('id', id); if (error) toast.error(error.message); else load(); }
  return (
    <Card><CardContent className="p-4 space-y-3">
      <Button size="sm" onClick={() => { setF({}); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Mandat anlegen</Button>
      <table className="w-full text-sm"><thead className="text-left text-muted-foreground text-xs"><tr><th className="py-2">Kunde</th><th>Mandatsreferenz</th><th>Datum</th><th>Kontoinhaber</th><th>IBAN</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((m) => <tr key={m.id} className="border-t border-border"><td className="py-2">{m.customer_name}</td><td>{m.mandate_reference}</td><td>{dt(m.mandate_date)}</td><td>{m.account_holder}</td><td className="font-mono text-xs">{m.iban_masked}</td>
          <td><Badge variant="outline" className={m.status === 'aktiv' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}>{m.status}</Badge></td>
          <td>{m.status === 'aktiv' && <Button size="sm" variant="ghost" onClick={() => setStatus(m.id, 'widerrufen')}>Widerrufen</Button>}</td></tr>)}
          {!rows.length && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Keine Mandate</td></tr>}</tbody></table>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>SEPA-Mandat anlegen</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <CustomerPicker value={f.customer_id} onChange={(id, c) => setF((x: any) => ({ ...x, customer_id: id, account_holder: x.account_holder || c.company_name || c.contact_name }))} />
          <Input placeholder="Mandatsreferenz" value={f.mandate_reference || ''} onChange={(e) => setF({ ...f, mandate_reference: e.target.value })} />
          <Input type="date" value={f.mandate_date || ''} onChange={(e) => setF({ ...f, mandate_date: e.target.value })} />
          <Input placeholder="Kontoinhaber" value={f.account_holder || ''} onChange={(e) => setF({ ...f, account_holder: e.target.value })} />
          <Input placeholder="IBAN" value={f.iban || ''} onChange={(e) => setF({ ...f, iban: e.target.value })} />
          <Input placeholder="BIC (optional)" value={f.bic || ''} onChange={(e) => setF({ ...f, bic: e.target.value })} />
        </div>
        <DialogFooter><Button disabled={!f.customer_id || !f.mandate_reference || !f.iban} onClick={save}>Speichern</Button></DialogFooter>
      </DialogContent></Dialog>
    </CardContent></Card>
  );
}

/* ---------------- Vorabinformationen ---------------- */
function Prenotifications() {
  const [rows, setRows] = useState<any[]>([]); const [del, setDel] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const { data } = await db.from('rp_prenotifications').select('*').order('created_at', { ascending: false }).limit(500); setRows(data || []);
    const { data: d } = await db.from('rp_notification_deliveries').select('*').order('created_at', { ascending: false }).limit(1000); setDel(d || []);
  })(); }, []);
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground mb-2">„Übergeben" bedeutet: vom Versanddienst angenommen. Eine tatsächliche Zustellung wird nicht behauptet.</p>
      <table className="w-full text-sm"><thead className="text-left text-muted-foreground text-xs"><tr><th className="py-2">Erstellt</th><th className="text-right">Betrag</th><th>Einzug</th><th>Mandat</th><th>Status</th><th>Versand</th></tr></thead>
        <tbody>{rows.map((r) => { const d = del.filter((x) => x.prenotification_id === r.id); return (
          <tr key={r.id} className="border-t border-border"><td className="py-2">{dt(r.created_at)}</td><td className="text-right">{eur(r.amount)}</td><td>{dt(r.collection_date)}</td><td>{r.mandate_reference}</td><td>{r.status}</td>
            <td className="text-xs">{d.map((x) => <div key={x.id}>{x.channel} · {x.status}{x.is_resend ? ' (erneut)' : ''} · {new Date(x.created_at).toLocaleString('de-DE')}{x.error ? ` · ${x.error}` : ''}</div>)}</td></tr>); })}
          {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Keine Vorabinformationen</td></tr>}</tbody></table>
    </CardContent></Card>
  );
}

/* ---------------- Rücklastschriften ---------------- */
function ReturnDebits() {
  const [rows, setRows] = useState<any[]>([]); const [names, setNames] = useState<Record<string, string>>({});
  const load = async () => { const { data } = await db.from('rp_return_debits').select('*').order('created_at', { ascending: false }); setRows(data || []);
    const ids = [...new Set((data || []).map((r: any) => r.customer_id).filter(Boolean))]; if (ids.length) { const { data: cs } = await db.from('customers').select('id,company_name,contact_name').in('id', ids); const m: any = {}; (cs || []).forEach((c: any) => (m[c.id] = c.company_name || c.contact_name)); setNames(m); } };
  useEffect(() => { load(); }, []);
  const act = async (id: string, status: string) => { const note = window.prompt('Notiz (wird protokolliert)') ?? ''; await rpc('rp_return_debit_action', { p_id: id, p_status: status, p_note: note }); load(); };
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground mb-2">Ein erneuter Einzug erfolgt nie automatisch. Bestehende Bank-Rücklastschriften bleiben zusätzlich unter „Bank & Zuordnung".</p>
      <table className="w-full text-sm"><thead className="text-left text-muted-foreground text-xs"><tr><th className="py-2">Kunde</th><th className="text-right">Betrag</th><th>Einzug</th><th>Rücklastschrift</th><th>Bankreferenz</th><th>Grund</th><th className="text-right">Gebühr</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-border"><td className="py-2">{names[r.customer_id]}</td><td className="text-right">{eur(r.original_amount)}</td><td>{dt(r.collection_date)}</td><td>{dt(r.return_date)}</td><td>{r.bank_reference}</td><td>{r.reason_code}</td><td className="text-right">{r.fee ? eur(r.fee) : '—'}</td>
          <td><Badge variant="outline" className={r.status === 'geklaert' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}>{r.status}</Badge></td>
          <td><Select onValueChange={(v) => act(r.id, v)}><SelectTrigger className="h-8 w-44"><SelectValue placeholder="Aktion…" /></SelectTrigger><SelectContent>
            <SelectItem value="kunde_kontaktiert">Kunde kontaktiert</SelectItem><SelectItem value="neuer_einzug_vorbereitet">Erneuten Einzug vorbereiten</SelectItem><SelectItem value="zahlungsart_geaendert">Zahlungsart ändern</SelectItem><SelectItem value="aufgabe_erstellt">Aufgabe erstellt</SelectItem><SelectItem value="geklaert">Manuell geklärt</SelectItem>
          </SelectContent></Select></td></tr>)}
          {!rows.length && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">Keine Rücklastschriften</td></tr>}</tbody></table>
    </CardContent></Card>
  );
}

/* ---------------- Einstellungen ---------------- */
function Settings() {
  const [s, setS] = useState<any>(null); const [cid, setCid] = useState('');
  const load = async () => { const { data } = await db.from('rp_settings').select('*').eq('id', 1).single(); setS(data); setCid(data?.creditor_id || ''); };
  useEffect(() => { load(); }, []);
  if (!s) return <Loader2 className="w-5 h-5 animate-spin" />;
  const suspicious = /O/.test((s.creditor_id || '').slice(7));
  async function save() { const { error } = await db.from('rp_settings').update({ creditor_name: s.creditor_name, prenotification_days: Number(s.prenotification_days), email_subject: s.email_subject, email_body: s.email_body, sms_body: s.sms_body }).eq('id', 1); if (error) toast.error(error.message); else { toast.success('Gespeichert'); load(); } }
  return (
    <Card><CardContent className="p-4 space-y-4 max-w-3xl">
      <div className="space-y-1">
        <Label className="text-xs">Gläubiger-ID</Label>
        <div className="flex gap-2"><Input value={cid} onChange={(e) => setCid(e.target.value.toUpperCase().replace(/\s/g, ''))} className="font-mono" />
          <Button size="sm" onClick={async () => { await rpc('rp_confirm_creditor', { p_creditor_id: cid }); toast.success('Gläubiger-ID bestätigt'); load(); }}>Prüfen & bestätigen</Button></div>
        <p className="text-xs">{s.creditor_id_confirmed ? <span className="text-emerald-500">Bestätigt: {s.creditor_id}</span> : <span className="text-red-500">Nicht bestätigt – Freigaben gesperrt.{suspicious && ' Die gespeicherte ID enthält den Buchstaben „O" statt Nullen (vermutlich DE02ZZZ00002605062).'}</span>}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Gläubigername</Label><Input value={s.creditor_name} onChange={(e) => setS({ ...s, creditor_name: e.target.value })} /></div>
        <div><Label className="text-xs">Vorlaufzeit Vorabinformation (Tage)</Label><Input type="number" min={1} max={60} value={s.prenotification_days} onChange={(e) => setS({ ...s, prenotification_days: e.target.value })} /></div>
      </div>
      <div><Label className="text-xs">E-Mail-Betreff</Label><Input value={s.email_subject} onChange={(e) => setS({ ...s, email_subject: e.target.value })} /></div>
      <div><Label className="text-xs">E-Mail-Text</Label><Textarea rows={12} value={s.email_body} onChange={(e) => setS({ ...s, email_body: e.target.value })} /></div>
      <div><Label className="text-xs">SMS-Text (keine vollständige IBAN!)</Label><Textarea rows={3} value={s.sms_body} onChange={(e) => setS({ ...s, sms_body: e.target.value })} /></div>
      <p className="text-xs text-muted-foreground">Platzhalter: {'{{customer_name}} {{amount}} {{collection_date}} {{invoice_number}} {{mandate_reference}} {{creditor_id}} {{creditor_name}}'}</p>
      <Card className="bg-muted/30"><CardContent className="p-3 text-sm whitespace-pre-line"><b>Vorschau:</b>{'\n'}{s.email_body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, k: string) => ({ customer_name: 'Max Muster', amount: '119,00 €', collection_date: '15.11.2026', invoice_number: '2026-11-0001', mandate_reference: 'M-0001', creditor_id: s.creditor_id, creditor_name: s.creditor_name } as any)[k] ?? '')}</CardContent></Card>
      <Button onClick={save}>Speichern</Button>
    </CardContent></Card>
  );
}

/* ---------------- Protokoll ---------------- */
function AuditLog() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { db.from('rp_audit_log').select('*').order('id', { ascending: false }).limit(500).then((r: any) => setRows(r.data || [])); }, []);
  return (
    <Card><CardContent className="p-4 overflow-x-auto">
      <table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-2">Zeit</th><th>Aktion</th><th>Objekt</th><th>Vorher</th><th>Nachher</th><th>Notiz</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-border align-top"><td className="py-1 whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</td><td>{r.action}</td><td>{r.entity}</td>
          <td className="max-w-[260px] truncate font-mono">{r.old_value ? JSON.stringify(r.old_value) : ''}</td><td className="max-w-[260px] truncate font-mono">{r.new_value ? JSON.stringify(r.new_value) : ''}</td><td>{r.note}</td></tr>)}
          {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Noch keine Einträge</td></tr>}</tbody></table>
    </CardContent></Card>
  );
}
