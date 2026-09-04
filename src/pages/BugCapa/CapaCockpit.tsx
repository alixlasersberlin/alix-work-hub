import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { evaluateCapa, progressPct, firstOpenStep, trafficLight, labelize, CAPA_STEPS } from '@/lib/capa/steps';
import { Section } from './_shared';

export default function CapaCockpit() {
  const [capas, setCapas] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const [c, a] = await Promise.all([
        sb.from('capas').select('*').order('created_at', { ascending: false }).limit(500),
        sb.from('capa_actions').select('id, capa_id, status, adverse_impact, adverse_impact_note, evidence_text, action_text').limit(2000),
      ]);
      if (c.error) toast.error('CAPA laden fehlgeschlagen: ' + c.error.message);
      setCapas(c.data ?? []); setActions(a.data ?? []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => capas.map(c => {
    const acts = actions.filter(a => a.capa_id === c.id);
    const checks = evaluateCapa(c, acts);
    return { capa: c, checks, pct: progressPct(checks), step: firstOpenStep(checks), light: trafficLight(c) };
  }), [capas, actions]);

  const today = Date.now();
  const kpis = [
    { label: 'Offene CAPAs', value: rows.filter(r => r.capa.status !== 'geschlossen').length },
    { label: 'Überfällige CAPAs', value: rows.filter(r => r.capa.status !== 'geschlossen' && r.capa.due_date && new Date(r.capa.due_date).getTime() < today).length },
    { label: 'Hohes Risiko', value: rows.filter(r => ['hoch', 'kritisch'].includes(r.capa.risk_level)).length },
    { label: 'Vigilanz offen', value: rows.filter(r => r.capa.vigilance_result === 'meldepflichtig' && !r.capa.vigilance_approved_at).length },
    { label: 'FSCA offen', value: rows.filter(r => r.capa.fsca_affected === true && !r.capa.fsca_released_at).length },
    { label: 'Wirksamkeitsprüfung fällig', value: rows.filter(r => r.capa.eff_check_date && new Date(r.capa.eff_check_date).getTime() <= today && !r.capa.eff_result).length },
    { label: 'No-CAPA-Entscheidungen', value: rows.filter(r => r.capa.capa_required === false).length },
  ];

  const groupBy = (key: string) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = (r.capa[key] as string) || '—';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Lade Cockpit …</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg border border-border p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-3xl font-semibold">{k.value}</div>
          </div>
        ))}
      </div>

      <Section title="CAPA-Fälle">
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Noch keine CAPA-Fälle.</p>}
          {rows.map(r => (
            <Link
              key={r.capa.id}
              to={`/bug-capa/capa/${r.capa.id}`}
              className="block rounded-lg border border-border p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0',
                    r.light === 'rot' ? 'bg-destructive' : r.light === 'gelb' ? 'bg-amber-500' : 'bg-emerald-500')} />
                  <span className="font-mono text-sm">{r.capa.capa_number ?? '—'}</span>
                  <span className="truncate text-sm">{r.capa.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.capa.capa_required === false && <Badge variant="destructive">No-CAPA</Badge>}
                  {r.capa.fsca_affected === true && <Badge variant="outline">FSCA</Badge>}
                  {r.capa.vigilance_result === 'meldepflichtig' && <Badge variant="outline">Meldepflichtig</Badge>}
                  <Badge variant="secondary">{labelize(r.capa.status)}</Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="h-2 w-40 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${r.pct}%` }} />
                </div>
                <span>{r.pct} %</span>
                <span>Aktuell: {r.step}. {CAPA_STEPS[r.step - 1].short}</span>
                {r.capa.due_date && <span>Frist: {r.capa.due_date}</span>}
                {r.capa.product_name && <span>Produkt: {r.capa.product_name}</span>}
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: 'CAPAs nach Produkt', data: groupBy('product_name') },
          { title: 'CAPAs nach Root Cause', data: groupBy('root_cause_kind') },
          { title: 'CAPAs nach Auslöser', data: groupBy('trigger_type') },
        ].map(g => (
          <div key={g.title} className="rounded-lg border border-border p-4">
            <div className="text-sm font-semibold mb-2">{g.title}</div>
            {g.data.length === 0 ? <p className="text-xs text-muted-foreground">Keine Daten.</p> : (
              <ul className="space-y-1 text-sm">
                {g.data.map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3"><span className="truncate">{labelize(k)}</span><span className="font-medium">{v}</span></li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
