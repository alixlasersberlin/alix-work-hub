import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CONTAINMENT_OPTIONS, VIGILANCE_QUESTIONS, VIGILANCE_RESULTS, INVESTIGATION_ITEMS, INVESTIGATION_STATUS,
  SCOPE_QUESTIONS, SCOPE_RESULTS, PMS_RESULTS, DECISION_FACTORS, RCA_METHODS, ISHIKAWA_CATEGORIES,
  ROOT_CAUSE_STATUS, ROOT_CAUSE_KIND, RISK_QUESTIONS, RISK_DECISIONS, ACTION_CATEGORIES, ACTION_STATUS_V2,
  FSCA_MEASURES, EFFECTIVENESS_RESULTS, PRODUCT_SECURED, YES_NO_UNCLEAR, labelize, CapaAny,
} from '@/lib/capa/steps';

export type SaveFn = (patch: Record<string, any>, stepNo: number, note?: string) => Promise<void>;

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Choice({ value, onChange, options, placeholder = 'Bitte wählen' }: {
  value: any; onChange: (v: string) => void; options: readonly string[] | string[]; placeholder?: string;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{labelize(o)}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function useDraft<T extends Record<string, any>>(initial: T, deps: any[]) {
  const [draft, setDraft] = useState<T>(initial);
  useEffect(() => { setDraft(initial); /* eslint-disable-next-line */ }, deps);
  const set = (k: string, v: any) => setDraft(d => ({ ...d, [k]: v }));
  return { draft, set, setDraft };
}

function SaveBar({ onSave, busy, extra }: { onSave: () => void; busy?: boolean; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border mt-4">
      <Button onClick={onSave} disabled={busy}>Schritt speichern</Button>
      {extra}
    </div>
  );
}

/* ------------------------------- Schritt 1 ------------------------------- */
export function Step1({ capa, save }: { capa: CapaAny; save: SaveFn }) {
  const { draft, set } = useDraft({
    complaint_number: capa.complaint_number ?? '', received_date: capa.received_date ?? '',
    customer_name: capa.customer_name ?? '', product_name: capa.product_name ?? '',
    product_ref: capa.product_ref ?? '', udi: capa.udi ?? '', serial_number: capa.serial_number ?? '',
    batch_number: capa.batch_number ?? '', patient_affected: capa.patient_affected ?? '',
    description: capa.description ?? '', health_consequences: capa.health_consequences ?? '',
    country: capa.country ?? '', market: capa.market ?? '', site: capa.site ?? '',
    product_secured: capa.product_secured ?? '', product_secured_reason: capa.product_secured_reason ?? '',
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);

  async function pullFromSerial() {
    if (!draft.serial_number.trim()) { toast.error('Seriennummer eingeben'); return; }
    const { data } = await (supabase as any)
      .from('lager_devices')
      .select('serial_number, modell, kunde_name, kunde_id, order_number')
      .eq('serial_number', draft.serial_number.trim()).maybeSingle();
    if (!data) { toast.error('Kein Gerät zu dieser Seriennummer gefunden'); return; }
    set('product_name', data.modell ?? draft.product_name);
    set('customer_name', data.kunde_name ?? draft.customer_name);
    toast.success('Geräte- und Kundendaten übernommen');
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Reklamationsnummer"><Input value={draft.complaint_number} onChange={e => set('complaint_number', e.target.value)} /></Field>
        <Field label="Eingangsdatum *"><Input type="date" value={draft.received_date} onChange={e => set('received_date', e.target.value)} /></Field>
        <Field label="Kunde / Melder"><Input value={draft.customer_name} onChange={e => set('customer_name', e.target.value)} /></Field>
        <Field label="Produktbezeichnung *"><Input value={draft.product_name} onChange={e => set('product_name', e.target.value)} /></Field>
        <Field label="REF"><Input value={draft.product_ref} onChange={e => set('product_ref', e.target.value)} /></Field>
        <Field label="UDI"><Input value={draft.udi} onChange={e => set('udi', e.target.value)} /></Field>
        <Field label="Seriennummer">
          <div className="flex gap-2">
            <Input value={draft.serial_number} onChange={e => set('serial_number', e.target.value)} />
            <Button type="button" variant="outline" onClick={pullFromSerial}>Geräteakte</Button>
          </div>
        </Field>
        <Field label="Chargennummer"><Input value={draft.batch_number} onChange={e => set('batch_number', e.target.value)} /></Field>
        <Field label="Betroffener Patient / Anwender"><Input value={draft.patient_affected} onChange={e => set('patient_affected', e.target.value)} /></Field>
        <Field label="Land"><Input value={draft.country} onChange={e => set('country', e.target.value)} /></Field>
        <Field label="Vertriebsmarkt"><Input value={draft.market} onChange={e => set('market', e.target.value)} /></Field>
        <Field label="Betroffener Standort"><Input value={draft.site} onChange={e => set('site', e.target.value)} /></Field>
      </div>
      <Field label="Beschreibung *"><Textarea rows={4} value={draft.description} onChange={e => set('description', e.target.value)} /></Field>
      <Field label="Gesundheitliche Folgen"><Textarea rows={2} value={draft.health_consequences} onChange={e => set('health_consequences', e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Produkt zur Untersuchung gesichert? *">
          <Choice value={draft.product_secured} onChange={v => set('product_secured', v)} options={PRODUCT_SECURED} />
        </Field>
        {draft.product_secured && draft.product_secured !== 'ja' && (
          <Field label="Begründung *"><Textarea rows={2} value={draft.product_secured_reason} onChange={e => set('product_secured_reason', e.target.value)} /></Field>
        )}
      </div>
      <SaveBar busy={busy} onSave={async () => { setBusy(true); await save({ ...draft, received_date: draft.received_date || null }, 1); setBusy(false); }} />
    </div>
  );
}

/* ------------------------------- Schritt 2 ------------------------------- */
export function Step2({ capa, save }: { capa: CapaAny; save: SaveFn }) {
  const { draft, set } = useDraft({
    immediate_danger: capa.immediate_danger ?? '',
    containment_actions: (capa.containment_actions ?? []) as string[],
    correction_text: capa.correction_text ?? capa.immediate_action ?? '',
    corrective_action: capa.corrective_action ?? '',
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);
  const toggle = (opt: string) => set('containment_actions',
    draft.containment_actions.includes(opt) ? draft.containment_actions.filter(o => o !== opt) : [...draft.containment_actions, opt]);

  return (
    <div className="space-y-4">
      <Field label="Besteht eine unmittelbare Gefährdung? *">
        <Choice value={draft.immediate_danger} onChange={v => set('immediate_danger', v)} options={YES_NO_UNCLEAR} />
      </Field>
      <Field label="Sofortmaßnahmen (Mehrfachauswahl)">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONTAINMENT_OPTIONS.map(o => (
            <label key={o} className="flex items-center gap-2 text-sm rounded-md border border-border px-3 py-2 cursor-pointer">
              <Checkbox checked={draft.containment_actions.includes(o)} onCheckedChange={() => toggle(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="CORRECTION – unmittelbare Korrektur des konkreten Problems *" hint="Beseitigt nur das konkrete Problem, nicht die Ursache.">
          <Textarea rows={4} value={draft.correction_text} onChange={e => set('correction_text', e.target.value)} />
        </Field>
        <Field label="CORRECTIVE ACTION – Beseitigung der Ursache" hint="Wird in Schritt 10 in konkrete Maßnahmen überführt.">
          <Textarea rows={4} value={draft.corrective_action} onChange={e => set('corrective_action', e.target.value)} />
        </Field>
      </div>
      <SaveBar busy={busy} onSave={async () => { setBusy(true); await save(draft, 2); setBusy(false); }} />
    </div>
  );
}

/* ------------------------------- Schritt 3 ------------------------------- */
export function Step3({ capa, save, canApprove, userId }: { capa: CapaAny; save: SaveFn; canApprove: boolean; userId?: string }) {
  const [rules, setRules] = useState<any[]>([]);
  const { draft, set } = useDraft({
    vigilance_answers: (capa.vigilance_answers ?? {}) as Record<string, string>,
    vigilance_result: capa.vigilance_result ?? '',
    vigilance_rule_code: capa.vigilance_rule_code ?? '',
    vigilance_deadline_date: capa.vigilance_deadline_date ?? '',
    vigilance_preliminary: !!capa.vigilance_preliminary,
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('capa_vigilance_rules').select('*').eq('active', true).order('sort_order');
      setRules(data ?? []);
    })();
  }, []);

  const setAns = (k: string, v: string) => set('vigilance_answers', { ...draft.vigilance_answers, [k]: v });

  function applyRule(code: string) {
    set('vigilance_rule_code', code);
    const rule = rules.find(r => r.code === code);
    const base = capa.received_date ? new Date(capa.received_date) : new Date();
    if (rule) {
      const d = new Date(base.getTime() + rule.days * 86400000);
      set('vigilance_deadline_date', d.toISOString().slice(0, 10));
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {VIGILANCE_QUESTIONS.map(q => (
          <div key={q.key} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">{q.label}</span>
            <div className="w-full sm:w-44">
              <Choice value={draft.vigilance_answers[q.key]} onChange={v => setAns(q.key, v)} options={YES_NO_UNCLEAR} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Ergebnis *"><Choice value={draft.vigilance_result} onChange={v => set('vigilance_result', v)} options={VIGILANCE_RESULTS} /></Field>
        {draft.vigilance_result === 'meldepflichtig' && (
          <>
            <Field label="Fristenkategorie *" hint="Pflegbar unter Vigilanz-Fristen (Admin).">
              <Select value={draft.vigilance_rule_code || undefined} onValueChange={applyRule}>
                <SelectTrigger><SelectValue placeholder="Kategorie wählen" /></SelectTrigger>
                <SelectContent>{rules.map(r => <SelectItem key={r.code} value={r.code}>{r.label} ({r.days} Tage)</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Meldefrist *"><Input type="date" value={draft.vigilance_deadline_date ?? ''} onChange={e => set('vigilance_deadline_date', e.target.value)} /></Field>
          </>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={draft.vigilance_preliminary} onCheckedChange={v => set('vigilance_preliminary', !!v)} />
        Vorläufige Vigilanzbewertung (QMB-Freigabe erforderlich)
      </label>
      {capa.vigilance_approved_at && <Badge variant="outline">QMB freigegeben am {new Date(capa.vigilance_approved_at).toLocaleDateString('de-DE')}</Badge>}
      <SaveBar
        busy={busy}
        onSave={async () => { setBusy(true); await save({ ...draft, vigilance_deadline_date: draft.vigilance_deadline_date || null }, 3); setBusy(false); }}
        extra={canApprove && draft.vigilance_preliminary && !capa.vigilance_approved_at ? (
          <Button variant="outline" onClick={() => save({ vigilance_approved_by: userId, vigilance_approved_at: new Date().toISOString() }, 3, 'QMB-Freigabe Vigilanzbewertung')}>
            QMB-Freigabe erteilen
          </Button>
        ) : null}
      />
    </div>
  );
}

/* ------------------------------- Schritt 4 ------------------------------- */
export function Step4({ capa, save }: { capa: CapaAny; save: SaveFn }) {
  const { draft, set } = useDraft({ investigation: (capa.investigation ?? {}) as Record<string, any> }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);
  const upd = (key: string, patch: any) => set('investigation', { ...draft.investigation, [key]: { ...(draft.investigation[key] ?? {}), ...patch } });

  return (
    <div className="space-y-3">
      {INVESTIGATION_ITEMS.map(it => {
        const row = draft.investigation[it.key] ?? {};
        return (
          <div key={it.key} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <span className="text-sm font-medium">{it.label}</span>
              <div className="w-full sm:w-56">
                <Choice value={row.status} onChange={v => upd(it.key, { status: v })} options={INVESTIGATION_STATUS} />
              </div>
            </div>
            {(row.status === 'nicht_pruefbar' || row.status === 'abweichung') && (
              <Textarea rows={2} placeholder={row.status === 'nicht_pruefbar' ? 'Begründung (Pflicht)' : 'Beschreibung der Abweichung'}
                value={row.note ?? ''} onChange={e => upd(it.key, { note: e.target.value })} />
            )}
          </div>
        );
      })}
      <SaveBar busy={busy} onSave={async () => { setBusy(true); await save(draft, 4); setBusy(false); }} />
    </div>
  );
}

/* ------------------------------- Schritt 5 ------------------------------- */
export function Step5({ capa, save }: { capa: CapaAny; save: SaveFn }) {
  const { draft, set } = useDraft({
    scope_answers: (capa.scope_answers ?? {}) as Record<string, any>,
    scope_result: capa.scope_result ?? '',
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<any | null>(null);
  const [scanning, setScanning] = useState(false);

  async function autoScan() {
    setScanning(true);
    const sb = supabase as any;
    const [sameBatch, sameProduct, similar] = await Promise.all([
      capa.batch_number ? sb.from('capas').select('id, capa_number, title').eq('batch_number', capa.batch_number).neq('id', capa.id) : Promise.resolve({ data: [] }),
      capa.product_name ? sb.from('capas').select('id, capa_number, title').eq('product_name', capa.product_name).neq('id', capa.id) : Promise.resolve({ data: [] }),
      capa.product_name ? sb.from('production_orders').select('id, production_order_number, reclamation_reason').eq('is_reclamation', true).ilike('modellname', `%${capa.product_name}%`).limit(20) : Promise.resolve({ data: [] }),
    ]);
    setScan({ sameBatch: sameBatch.data ?? [], sameProduct: sameProduct.data ?? [], similar: similar.data ?? [] });
    setScanning(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {SCOPE_QUESTIONS.map(q => (
          <div key={q.key} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">{q.label}</span>
            <div className="w-full sm:w-44">
              <Choice value={draft.scope_answers[q.key]} onChange={v => set('scope_answers', { ...draft.scope_answers, [q.key]: v })} options={YES_NO_UNCLEAR} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72"><Field label="Ergebnis *"><Choice value={draft.scope_result} onChange={v => set('scope_result', v)} options={SCOPE_RESULTS} /></Field></div>
        <Button variant="outline" onClick={autoScan} disabled={scanning}>{scanning ? 'Suche …' : 'Bestandsdaten durchsuchen'}</Button>
      </div>
      {scan && (
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-md border border-border p-3"><div className="text-muted-foreground text-xs">Gleiche Charge</div><div className="text-2xl font-semibold">{scan.sameBatch.length}</div></div>
          <div className="rounded-md border border-border p-3"><div className="text-muted-foreground text-xs">Gleiches Produkt (CAPA)</div><div className="text-2xl font-semibold">{scan.sameProduct.length}</div></div>
          <div className="rounded-md border border-border p-3"><div className="text-muted-foreground text-xs">Ähnliche Reklamationen</div><div className="text-2xl font-semibold">{scan.similar.length}</div></div>
        </div>
      )}
      <SaveBar busy={busy} onSave={async () => { setBusy(true); await save(draft, 5); setBusy(false); }} />
    </div>
  );
}

/* ------------------------------- Schritt 6 ------------------------------- */
export function Step6({ capa, save }: { capa: CapaAny; save: SaveFn }) {
  const { draft, set } = useDraft({
    pms_assessment: capa.pms_assessment ?? '',
    pms_stats: (capa.pms_stats ?? {}) as Record<string, any>,
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const since = new Date(Date.now() - 365 * 86400000).toISOString();
      const [capasSame, reklas, bugsSame] = await Promise.all([
        capa.product_name ? sb.from('capas').select('id', { count: 'exact', head: true }).eq('product_name', capa.product_name).gte('created_at', since) : Promise.resolve({ count: 0 }),
        sb.from('production_orders').select('id', { count: 'exact', head: true }).eq('is_reclamation', true).gte('created_at', since),
        capa.product_name ? sb.from('bugs').select('id', { count: 'exact', head: true }).ilike('product', `%${capa.product_name}%`).gte('created_at', since) : Promise.resolve({ count: 0 }),
      ]);
      setStats({ capas12m: capasSame.count ?? 0, reklas12m: reklas.count ?? 0, bugs12m: bugsSame.count ?? 0 });
    })();
  }, [capa.product_name]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { l: 'Vergleichbare CAPAs (12 Mon.)', v: stats?.capas12m },
          { l: 'Reklamationen gesamt (12 Mon.)', v: stats?.reklas12m },
          { l: 'Bugs zum Produkt (12 Mon.)', v: stats?.bugs12m },
        ].map(s => (
          <div key={s.l} className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">{s.l}</div>
            <div className="text-2xl font-semibold">{s.v ?? '…'}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bewertung *"><Choice value={draft.pms_assessment} onChange={v => set('pms_assessment', v)} options={PMS_RESULTS} /></Field>
        <Field label="Notiz zum Trend">
          <Textarea rows={3} value={draft.pms_stats.note ?? ''} onChange={e => set('pms_stats', { ...draft.pms_stats, note: e.target.value })} />
        </Field>
      </div>
      <SaveBar busy={busy} onSave={async () => { setBusy(true); await save({ ...draft, pms_stats: { ...draft.pms_stats, ...stats } }, 6); setBusy(false); }} />
    </div>
  );
}

/* ------------------------------- Schritt 7 ------------------------------- */
export function Step7({ capa, save, canApprove, userId }: { capa: CapaAny; save: SaveFn; canApprove: boolean; userId?: string }) {
  const { draft, set } = useDraft({
    decision_factors: (capa.decision_factors ?? {}) as Record<string, boolean>,
    capa_required: capa.capa_required,
    no_capa_reason: capa.no_capa_reason ?? '',
    no_capa_risk: capa.no_capa_risk ?? '',
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);
  const hits = DECISION_FACTORS.filter(f => draft.decision_factors[f.key]).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Eine Reklamation wird <span className="font-medium text-foreground">nicht automatisch</span> zur CAPA. Die Entscheidung ist ein
        formaler Gatekeeper und muss dokumentiert werden – auch die No-CAPA-Decision.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {DECISION_FACTORS.map(f => (
          <label key={f.key} className="flex items-center gap-2 text-sm rounded-md border border-border px-3 py-2 cursor-pointer">
            <Checkbox checked={!!draft.decision_factors[f.key]} onCheckedChange={v => set('decision_factors', { ...draft.decision_factors, [f.key]: !!v })} />
            {f.label}
          </label>
        ))}
      </div>
      <div className="text-sm">Zutreffende Kriterien: <span className="font-semibold">{hits}</span> {hits > 0 && '– CAPA-Eröffnung wird empfohlen.'}</div>
      <div className="flex flex-wrap gap-2">
        <Button variant={draft.capa_required === true ? 'default' : 'outline'} onClick={() => set('capa_required', true)}>CAPA eröffnen</Button>
        <Button variant={draft.capa_required === false ? 'destructive' : 'outline'} onClick={() => set('capa_required', false)}>No-CAPA-Decision</Button>
      </div>
      {draft.capa_required === false && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Begründung *"><Textarea rows={4} value={draft.no_capa_reason} onChange={e => set('no_capa_reason', e.target.value)} /></Field>
          <Field label="Risikobewertung *"><Textarea rows={4} value={draft.no_capa_risk} onChange={e => set('no_capa_risk', e.target.value)} /></Field>
        </div>
      )}
      {capa.decision_at && (
        <div className="text-xs text-muted-foreground">
          Entscheidung dokumentiert am {new Date(capa.decision_at).toLocaleString('de-DE')}
          {capa.decision_approved_at && ` · QMB-Freigabe am ${new Date(capa.decision_approved_at).toLocaleString('de-DE')}`}
        </div>
      )}
      <SaveBar
        busy={busy}
        onSave={async () => {
          setBusy(true);
          await save({ ...draft, decision_by: userId ?? null, decision_at: new Date().toISOString() }, 7,
            draft.capa_required === false ? 'NO-CAPA-DECISION dokumentiert' : 'CAPA eröffnet');
          setBusy(false);
        }}
        extra={canApprove && capa.capa_required === false && !capa.decision_approved_at ? (
          <Button variant="outline" onClick={() => save({ decision_approved_by: userId, decision_approved_at: new Date().toISOString() }, 7, 'QMB-Freigabe No-CAPA-Decision')}>
            QMB-Freigabe No-CAPA
          </Button>
        ) : null}
      />
    </div>
  );
}

/* ------------------------------- Schritt 8 ------------------------------- */
export function Step8({ capa, save }: { capa: CapaAny; save: SaveFn }) {
  const { draft, set } = useDraft({
    rca_method: capa.rca_method ?? '', rca_data: (capa.rca_data ?? {}) as Record<string, any>,
    failure_mode: capa.failure_mode ?? '', direct_cause: capa.direct_cause ?? '',
    root_cause: capa.root_cause ?? '', root_cause_kind: capa.root_cause_kind ?? '',
    root_cause_status: capa.root_cause_status ?? '', root_cause_note: capa.root_cause_note ?? '',
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);
  const whys: string[] = draft.rca_data.whys ?? ['', '', '', '', ''];
  const ishikawa: Record<string, string> = draft.rca_data.ishikawa ?? {};

  return (
    <div className="space-y-4">
      <Field label="Methode *"><Choice value={draft.rca_method} onChange={v => set('rca_method', v)} options={RCA_METHODS} /></Field>
      {draft.rca_method === '5_why' && (
        <div className="space-y-2">
          {whys.map((w, i) => (
            <Field key={i} label={`Warum ${i + 1}?`}>
              <Textarea rows={2} value={w} onChange={e => {
                const next = [...whys]; next[i] = e.target.value; set('rca_data', { ...draft.rca_data, whys: next });
              }} />
            </Field>
          ))}
        </div>
      )}
      {draft.rca_method === 'ishikawa' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {ISHIKAWA_CATEGORIES.map(c => (
            <Field key={c} label={c}>
              <Textarea rows={2} value={ishikawa[c] ?? ''} onChange={e => set('rca_data', { ...draft.rca_data, ishikawa: { ...ishikawa, [c]: e.target.value } })} />
            </Field>
          ))}
        </div>
      )}
      {(draft.rca_method === 'fta' || draft.rca_method === 'frei') && (
        <Field label={draft.rca_method === 'fta' ? 'Fault Tree Analysis' : 'Freie Ursachenanalyse'}>
          <Textarea rows={6} value={draft.rca_data.free ?? ''} onChange={e => set('rca_data', { ...draft.rca_data, free: e.target.value })} />
        </Field>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Field label="Fehlerbild *"><Textarea rows={3} value={draft.failure_mode} onChange={e => set('failure_mode', e.target.value)} /></Field>
        <Field label="Direkte Ursache *"><Textarea rows={3} value={draft.direct_cause} onChange={e => set('direct_cause', e.target.value)} /></Field>
        <Field label="Root Cause *"><Textarea rows={3} value={draft.root_cause} onChange={e => set('root_cause', e.target.value)} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ursachenart *"><Choice value={draft.root_cause_kind} onChange={v => set('root_cause_kind', v)} options={ROOT_CAUSE_KIND} /></Field>
        <Field label="Status *"><Choice value={draft.root_cause_status} onChange={v => set('root_cause_status', v)} options={ROOT_CAUSE_STATUS} /></Field>
      </div>
      {draft.root_cause_status === 'nicht_ermittelbar' && (
        <Field label="Begründung *" hint="QMB-Freigabe erforderlich."><Textarea rows={3} value={draft.root_cause_note} onChange={e => set('root_cause_note', e.target.value)} /></Field>
      )}
      <SaveBar busy={busy} onSave={async () => { setBusy(true); await save(draft, 8); setBusy(false); }} />
    </div>
  );
}

/* ------------------------------- Schritt 9 ------------------------------- */
export function Step9({ capa, save }: { capa: CapaAny; save: SaveFn }) {
  const { draft, set } = useDraft({
    risk_answers: (capa.risk_answers ?? {}) as Record<string, string>,
    risk_before: (capa.risk_before ?? {}) as Record<string, any>,
    risk_after: (capa.risk_after ?? {}) as Record<string, any>,
    risk_decision: capa.risk_decision ?? '', risk_evidence: capa.risk_evidence ?? '',
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);
  const num = (v: any) => (v === '' || v === undefined || v === null ? '' : String(v));
  const rpn = (r: Record<string, any>) => (Number(r.p) || 0) * (Number(r.s) || 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {RISK_QUESTIONS.map(q => (
          <div key={q.key} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm">{q.label}</span>
            <div className="w-full sm:w-44">
              <Choice value={draft.risk_answers[q.key]} onChange={v => set('risk_answers', { ...draft.risk_answers, [q.key]: v })} options={YES_NO_UNCLEAR} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['risk_before', 'risk_after'] as const).map(key => (
          <div key={key} className="rounded-md border border-border p-3 space-y-3">
            <div className="text-sm font-semibold">{key === 'risk_before' ? 'Risikobewertung VORHER' : 'Risikobewertung NACHHER'}</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Auftreten (1-5)">
                <Input type="number" min={1} max={5} value={num((draft as any)[key].p)} onChange={e => set(key, { ...(draft as any)[key], p: e.target.value })} />
              </Field>
              <Field label="Schwere (1-5)">
                <Input type="number" min={1} max={5} value={num((draft as any)[key].s)} onChange={e => set(key, { ...(draft as any)[key], s: e.target.value })} />
              </Field>
            </div>
            <div className="text-sm">Risikoprioritätszahl: <span className="font-semibold">{rpn((draft as any)[key]) || '—'}</span></div>
          </div>
        ))}
      </div>
      <Field label="Entscheidung *"><Choice value={draft.risk_decision} onChange={v => set('risk_decision', v)} options={RISK_DECISIONS} /></Field>
      {draft.risk_decision && draft.risk_decision !== 'akte_unveraendert' && (
        <Field label="Nachweis der Aktualisierung (Dokument / Referenz) *">
          <Textarea rows={2} value={draft.risk_evidence} onChange={e => set('risk_evidence', e.target.value)} />
        </Field>
      )}
      <SaveBar busy={busy} onSave={async () => { setBusy(true); await save(draft, 9); setBusy(false); }} />
    </div>
  );
}

/* ------------------------------ Schritt 10 ------------------------------ */
export function Step10({ capa, actions, reload, userId }: { capa: CapaAny; actions: CapaAny[]; reload: () => void; userId?: string }) {
  const [form, setForm] = useState<any>({ action_text: '', category: '', root_cause_ref: '', start_date: '', due_date: '', priority: 'normal', expected_result: '' });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!form.action_text.trim()) { toast.error('Beschreibung erforderlich'); return; }
    setBusy(true);
    const { error } = await (supabase as any).from('capa_actions').insert({
      capa_id: capa.id, source: 'capa', action_text: form.action_text.trim(), category: form.category || null,
      root_cause_ref: form.root_cause_ref || capa.root_cause || null, start_date: form.start_date || null,
      due_date: form.due_date || null, priority: form.priority, expected_result: form.expected_result || null,
      responsible_id: userId ?? null, created_by: userId ?? null, status: 'offen',
    });
    setBusy(false);
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    setForm({ action_text: '', category: '', root_cause_ref: '', start_date: '', due_date: '', priority: 'normal', expected_result: '' });
    reload();
  }

  async function patch(id: string, p: any) {
    const { error } = await (supabase as any).from('capa_actions').update(p).eq('id', id);
    if (error) { toast.error('Update fehlgeschlagen: ' + error.message); return; }
    reload();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border p-4 space-y-3">
        <div className="text-sm font-semibold">Neue Maßnahme aus Root Cause</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Kategorie"><Choice value={form.category} onChange={v => setForm({ ...form, category: v })} options={ACTION_CATEGORIES} /></Field>
          <Field label="Startdatum"><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="Frist"><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></Field>
          <Field label="Priorität"><Choice value={form.priority} onChange={v => setForm({ ...form, priority: v })} options={['niedrig', 'normal', 'hoch', 'dringend']} /></Field>
          <Field label="Bezug zur Root Cause"><Input value={form.root_cause_ref} onChange={e => setForm({ ...form, root_cause_ref: e.target.value })} placeholder={capa.root_cause ?? ''} /></Field>
          <Field label="Erwartetes Ergebnis"><Input value={form.expected_result} onChange={e => setForm({ ...form, expected_result: e.target.value })} /></Field>
        </div>
        <Field label="Beschreibung *"><Textarea rows={3} value={form.action_text} onChange={e => setForm({ ...form, action_text: e.target.value })} /></Field>
        <Button onClick={add} disabled={busy}>Maßnahme hinzufügen</Button>
      </div>

      <div className="space-y-3">
        {actions.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Maßnahmen erfasst.</p>}
        {actions.map(a => (
          <div key={a.id} className="rounded-md border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="text-sm font-medium">{a.action_text}</div>
              <div className="flex flex-wrap gap-2 items-center">
                {a.category && <Badge variant="outline">{a.category}</Badge>}
                <div className="w-40"><Choice value={a.status} onChange={v => patch(a.id, { status: v, completed_at: ['umgesetzt', 'verifiziert'].includes(v) ? new Date().toISOString().slice(0, 10) : null })} options={ACTION_STATUS_V2} /></div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs text-muted-foreground">
              <div>Start: {a.start_date ?? '—'}</div><div>Frist: {a.due_date ?? '—'}</div><div>Priorität: {labelize(a.priority)}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Umsetzungsnachweis *">
                <Textarea rows={2} defaultValue={a.evidence_text ?? ''} onBlur={e => e.target.value !== (a.evidence_text ?? '') && patch(a.id, { evidence_text: e.target.value })} />
              </Field>
              <div className="space-y-3">
                <Field label="Nachteilige Auswirkungen auf Sicherheit, Leistung, Usability, Software, Konformität, andere Produkte/Prozesse? *">
                  <Choice value={a.adverse_impact} onChange={v => patch(a.id, { adverse_impact: v })} options={YES_NO_UNCLEAR} />
                </Field>
                {a.adverse_impact && a.adverse_impact !== 'nein' && (
                  <Field label="Folgebewertung *">
                    <Textarea rows={2} defaultValue={a.adverse_impact_note ?? ''} onBlur={e => e.target.value !== (a.adverse_impact_note ?? '') && patch(a.id, { adverse_impact_note: e.target.value })} />
                  </Field>
                )}
              </div>
            </div>
            {a.status === 'umgesetzt' && (
              <Button size="sm" variant="outline" onClick={() => patch(a.id, { status: 'verifiziert', verified_by: userId ?? null, verified_at: new Date().toISOString() })}>
                Umsetzung verifizieren
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Schritt 11 ------------------------------ */
export function Step11({ capa, save, canApprove, userId }: { capa: CapaAny; save: SaveFn; canApprove: boolean; userId?: string }) {
  const { draft, set } = useDraft({
    fsca_affected: capa.fsca_affected, fsca: (capa.fsca ?? {}) as Record<string, any>,
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<any[] | null>(null);
  const f = draft.fsca;
  const setF = (k: string, v: any) => set('fsca', { ...f, [k]: v });

  async function findDevices() {
    const sb = supabase as any;
    let q = sb.from('lager_devices').select('id, serial_number, modell, kunde_name, status').limit(200);
    if (capa.product_name) q = q.ilike('modell', `%${capa.product_name}%`);
    const { data } = await q;
    setDevices(data ?? []);
    setF('affected_count', (data ?? []).length);
  }

  return (
    <div className="space-y-4">
      <Field label="Sind bereits ausgelieferte Produkte betroffen? *">
        <div className="flex gap-2">
          <Button variant={draft.fsca_affected === false ? 'default' : 'outline'} onClick={() => set('fsca_affected', false)}>Nein</Button>
          <Button variant={draft.fsca_affected === true ? 'destructive' : 'outline'} onClick={() => set('fsca_affected', true)}>Ja – FSCA-Bewertung</Button>
        </div>
      </Field>
      {draft.fsca_affected === true && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Maßnahme *"><Choice value={f.measure} onChange={v => setF('measure', v)} options={FSCA_MEASURES} /></Field>
            <Field label="Startdatum"><Input type="date" value={f.start_date ?? ''} onChange={e => setF('start_date', e.target.value)} /></Field>
            <Field label="Verantwortlicher *"><Input value={f.responsible ?? ''} onChange={e => setF('responsible', e.target.value)} /></Field>
            <Field label="Betroffene Produkte"><Input value={f.products ?? capa.product_name ?? ''} onChange={e => setF('products', e.target.value)} /></Field>
            <Field label="Seriennummern"><Input value={f.serials ?? ''} onChange={e => setF('serials', e.target.value)} /></Field>
            <Field label="Chargen"><Input value={f.batches ?? ''} onChange={e => setF('batches', e.target.value)} /></Field>
            <Field label="Kunden"><Input value={f.customers ?? ''} onChange={e => setF('customers', e.target.value)} /></Field>
            <Field label="Länder"><Input value={f.countries ?? ''} onChange={e => setF('countries', e.target.value)} /></Field>
            <Field label="Anzahl"><Input value={f.affected_count ?? ''} onChange={e => setF('affected_count', e.target.value)} /></Field>
          </div>
          <Field label="Kommunikation (Field Safety Notice, Kundeninformation)"><Textarea rows={3} value={f.communication ?? ''} onChange={e => setF('communication', e.target.value)} /></Field>
          <Field label="Behördenmeldung"><Textarea rows={2} value={f.authority ?? ''} onChange={e => setF('authority', e.target.value)} /></Field>
          <Field label="Abschluss"><Textarea rows={2} value={f.closure ?? ''} onChange={e => setF('closure', e.target.value)} /></Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={findDevices}>Betroffene Geräte identifizieren</Button>
            {devices && <span className="text-sm text-muted-foreground">{devices.length} Geräte gefunden (keine Aktion ausgeführt)</span>}
          </div>
          {devices && devices.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-md border border-border text-xs">
              {devices.map(d => (
                <div key={d.id} className="flex flex-wrap gap-3 px-3 py-1.5 border-b border-border/60">
                  <span className="font-mono">{d.serial_number}</span><span>{d.modell}</span>
                  <span className="text-muted-foreground">{d.kunde_name}</span><span className="text-muted-foreground">{d.status}</span>
                </div>
              ))}
            </div>
          )}
          {capa.fsca_released_at
            ? <Badge variant="outline">FSCA freigegeben am {new Date(capa.fsca_released_at).toLocaleString('de-DE')}</Badge>
            : <p className="text-xs text-muted-foreground">FSCA muss durch QMB / Freigabeberechtigten freigegeben werden. Es wird keine Maßnahme automatisch ausgeführt.</p>}
        </>
      )}
      <SaveBar
        busy={busy}
        onSave={async () => { setBusy(true); await save(draft, 11); setBusy(false); }}
        extra={canApprove && draft.fsca_affected === true && !capa.fsca_released_at ? (
          <Button variant="outline" onClick={() => save({ fsca_released_by: userId, fsca_released_at: new Date().toISOString() }, 11, 'FSCA freigegeben')}>FSCA freigeben</Button>
        ) : null}
      />
    </div>
  );
}

/* ------------------------------ Schritt 12 ------------------------------ */
export function Step12({ capa, save, onFollowUp }: { capa: CapaAny; save: SaveFn; onFollowUp: () => void }) {
  const { draft, set } = useDraft({
    eff_criterion: capa.eff_criterion ?? '', eff_method: capa.eff_method ?? '', eff_period: capa.eff_period ?? '',
    eff_start: capa.eff_start ?? '', eff_check_date: capa.eff_check_date ?? '', eff_target: capa.eff_target ?? '',
    eff_actual: capa.eff_actual ?? '', eff_evidence: capa.eff_evidence ?? '', eff_result: capa.eff_result ?? '',
  }, [capa.id, capa.updated_at]);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Eine CAPA gilt nicht als wirksam, nur weil Maßnahmen als „umgesetzt“ markiert sind. Beispiele für Kriterien:
        0 Wiederholungsreklamationen / 6 Monate · 0 Wiederholungsreklamationen / 5.000 Geräte · Fehlerrate &lt; Grenzwert · Prozessfähigkeit bestanden.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Wirksamkeitskriterium *"><Textarea rows={2} value={draft.eff_criterion} onChange={e => set('eff_criterion', e.target.value)} /></Field>
        <Field label="Messmethode *"><Textarea rows={2} value={draft.eff_method} onChange={e => set('eff_method', e.target.value)} /></Field>
        <Field label="Beobachtungszeitraum"><Input value={draft.eff_period} onChange={e => set('eff_period', e.target.value)} placeholder="z. B. 6 Monate" /></Field>
        <Field label="Start"><Input type="date" value={draft.eff_start ?? ''} onChange={e => set('eff_start', e.target.value)} /></Field>
        <Field label="Prüfdatum"><Input type="date" value={draft.eff_check_date ?? ''} onChange={e => set('eff_check_date', e.target.value)} /></Field>
        <Field label="Sollwert"><Input value={draft.eff_target} onChange={e => set('eff_target', e.target.value)} /></Field>
        <Field label="Istwert"><Input value={draft.eff_actual} onChange={e => set('eff_actual', e.target.value)} /></Field>
        <Field label="Ergebnis *"><Choice value={draft.eff_result} onChange={v => set('eff_result', v)} options={EFFECTIVENESS_RESULTS} /></Field>
      </div>
      <Field label="Nachweis"><Textarea rows={2} value={draft.eff_evidence} onChange={e => set('eff_evidence', e.target.value)} /></Field>
      {draft.eff_result === 'nicht_wirksam' && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm space-y-2">
          <div className="font-medium">NICHT WIRKSAM – CAPA darf nicht geschlossen werden.</div>
          <Button size="sm" variant="outline" onClick={onFollowUp}>Folge-CAPA erzeugen</Button>
        </div>
      )}
      <SaveBar busy={busy} onSave={async () => {
        setBusy(true);
        await save({ ...draft, eff_start: draft.eff_start || null, eff_check_date: draft.eff_check_date || null }, 12);
        setBusy(false);
      }} />
    </div>
  );
}
