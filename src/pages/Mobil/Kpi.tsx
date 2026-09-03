/**
 * MANAGEMENT KPI DASHBOARD (Prompt 6) – nur für berechtigte Rollen.
 * Kennzahlen werden ausschliesslich aus vorhandenen Feldern berechnet. Fehlt
 * die Datenbasis (z. B. historisch kein first_response_at), wird
 * "Daten unvollständig" ausgewiesen statt eines erfundenen Durchschnitts.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchCommandSnapshot, minutesLabel } from '@/lib/mobil/command';

const RANGES = [
  { key: 'HEUTE', label: 'Heute', days: 0 },
  { key: 'D7', label: '7 Tage', days: 7 },
  { key: 'D30', label: '30 Tage', days: 30 },
] as const;

type Kpis = {
  incoming: number;
  answered: number;
  frtAvg: number | null;
  frtMedian: number | null;
  frtCoverage: number;
  p1: number;
  p2: number;
  escalations: number;
  ticketsOpen: number;
  ticketsDone: number;
  resolutionAvg: number | null;
  resolutionCoverage: number;
  unassigned: number;
};

export default function MobilKpi() {
  const nav = useNavigate();
  const [range, setRange] = useState<typeof RANGES[number]['key']>('HEUTE');
  const [kpi, setKpi] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await fetchCommandSnapshot();
      if (!snap.is_supervisor) { setDenied(true); setLoading(false); return; }

      const cfg = RANGES.find((r) => r.key === range)!;
      const from = new Date();
      if (cfg.days === 0) from.setHours(0, 0, 0, 0);
      else from.setDate(from.getDate() - cfg.days);
      const iso = from.toISOString();

      const [convs, tks, esc] = await Promise.all([
        (supabase as any).from('ac_conversations')
          .select('id, priority, created_at, first_response_at, assigned_to, status')
          .gte('created_at', iso).eq('is_test', false).limit(2000),
        (supabase as any).from('tickets')
          .select('id, status, created_at, resolved_at')
          .gte('created_at', iso).limit(2000),
        (supabase as any).from('conversation_escalations')
          .select('id', { count: 'exact', head: true })
          .gte('triggered_at', iso).eq('status', 'TRIGGERED'),
      ]);

      const cs = (convs.data || []) as any[];
      const frt = cs
        .filter((c) => c.first_response_at)
        .map((c) => (new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime()) / 60000)
        .filter((n) => n >= 0)
        .sort((a, b) => a - b);
      const ts = (tks.data || []) as any[];
      const doneT = ts.filter((t) => t.resolved_at);
      const res = doneT
        .map((t) => (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 60000)
        .filter((n) => n >= 0);

      setKpi({
        incoming: cs.length,
        answered: cs.filter((c) => c.first_response_at).length,
        frtAvg: frt.length ? frt.reduce((a, b) => a + b, 0) / frt.length : null,
        frtMedian: frt.length ? frt[Math.floor(frt.length / 2)] : null,
        frtCoverage: cs.length ? frt.length / cs.length : 0,
        p1: cs.filter((c) => c.priority === 'P1').length,
        p2: cs.filter((c) => c.priority === 'P2').length,
        escalations: esc.count ?? 0,
        ticketsOpen: ts.filter((t) => !['closed', 'geschlossen', 'erledigt', 'resolved'].includes((t.status || '').toLowerCase())).length,
        ticketsDone: ts.length - ts.filter((t) => !['closed', 'geschlossen', 'erledigt', 'resolved'].includes((t.status || '').toLowerCase())).length,
        resolutionAvg: res.length ? res.reduce((a, b) => a + b, 0) / res.length : null,
        resolutionCoverage: doneT.length ? res.length / Math.max(1, ts.length) : 0,
        unassigned: cs.filter((c) => !c.assigned_to && c.status !== 'closed').length,
      });
    } catch (e) {
      setKpi(null);
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  if (denied) return <div className="p-6 text-sm text-muted-foreground">Für dieses Dashboard fehlt die Berechtigung.</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Kennzahlen</h1>
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={load} aria-label="Aktualisieren">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
        </Button>
      </div>

      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRange(r.key)}
            className={`px-3 py-1.5 rounded-full text-xs border min-h-[34px] ${
              range === r.key ? 'border-primary bg-primary/15 text-primary font-semibold' : 'border-border text-muted-foreground'
            }`}>{r.label}</button>
        ))}
      </div>

      {loading && <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>}

      {kpi && (
        <div className="grid grid-cols-2 gap-2">
          <Tile v={kpi.incoming} l="Eingegangene Chats" onClick={() => nav('/mobil/inbox')} />
          <Tile v={kpi.answered} l="Beantwortet" onClick={() => nav('/mobil/inbox')} />
          <Tile
            v={kpi.frtCoverage < 0.6 || kpi.frtAvg == null ? '—' : minutesLabel(kpi.frtAvg)}
            l="Ø Erstreaktion"
            hint={kpi.frtCoverage < 0.6 ? 'Daten unvollständig' : `${Math.round(kpi.frtCoverage * 100)} % erfasst`}
          />
          <Tile
            v={kpi.frtCoverage < 0.6 || kpi.frtMedian == null ? '—' : minutesLabel(kpi.frtMedian)}
            l="Median Erstreaktion"
            hint={kpi.frtCoverage < 0.6 ? 'Daten unvollständig' : undefined}
          />
          <Tile v={kpi.p1} l="P1 Fälle" onClick={() => nav('/mobil/inbox?prio=P1')} />
          <Tile v={kpi.p2} l="P2 Fälle" onClick={() => nav('/mobil/inbox?prio=P2')} />
          <Tile v={kpi.escalations} l="Eskalationen" onClick={() => nav('/mobil/admin/eskalationen')} />
          <Tile v={kpi.unassigned} l="Nicht zugewiesen" onClick={() => nav('/mobil/supervisor')} />
          <Tile v={kpi.ticketsOpen} l="Tickets offen" onClick={() => nav('/mobil/tickets')} />
          <Tile v={kpi.ticketsDone} l="Tickets erledigt" onClick={() => nav('/mobil/tickets?tab=ERLEDIGT')} />
          <Tile
            v={kpi.resolutionAvg == null ? '—' : minutesLabel(kpi.resolutionAvg)}
            l="Ø Lösungszeit"
            hint={kpi.resolutionAvg == null ? 'Daten unvollständig' : undefined}
          />
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Kennzahlen dienen der operativen Steuerung. Es findet keine Bewertung einzelner Mitarbeiter statt.
      </p>
    </div>
  );
}

function Tile({ v, l, hint, onClick }: { v: number | string; l: string; hint?: string; onClick?: () => void }) {
  const inner = (
    <Card className="p-3 min-h-[84px] flex flex-col justify-between active:bg-muted/40">
      <div className="text-xl font-bold leading-none">{v}</div>
      <div>
        <div className="text-[11px] text-muted-foreground leading-tight">{l}</div>
        {hint && <div className="text-[10px] text-amber-500 mt-0.5">{hint}</div>}
      </div>
    </Card>
  );
  return onClick ? <button onClick={onClick} className="text-left">{inner}</button> : inner;
}
