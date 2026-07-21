import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, Calendar, Activity, Zap, Gauge } from 'lucide-react';
import { toast } from 'sonner';

type Shift = { id: string; agent_id: string; shift_start: string; shift_end: string; shift_type: string; status: string; notes: string | null; approval_status?: string; approved_by?: string | null; approved_at?: string | null };
type Forecast = { id: string; forecast_date: string; channel: string; interval_start: string; predicted_volume: number; predicted_aht_sec: number; required_agents: number };

export default function AlixConnectWfm() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [adherence, setAdherence] = useState<any[]>([]);
  const [autoForecast, setAutoForecast] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [s, f, a, ad, af] = await Promise.all([
      supabase.from('ac_wfm_shifts').select('*').order('shift_start', { ascending: false }).limit(50),
      supabase.from('ac_wfm_forecasts').select('*').order('interval_start', { ascending: true }).limit(48),
      supabase.from('user_profiles').select('id, full_name').limit(200),
      supabase.rpc('ac_wfm_adherence_live'),
      supabase.rpc('ac_wfm_auto_forecast', { horizon_hours: 24 }),
    ]);
    setShifts((s.data as any) ?? []);
    setForecasts((f.data as any) ?? []);
    setAgents(((a.data as any) ?? []).map((u: any) => ({ id: u.id, name: u.full_name ?? u.id })));
    setAdherence((ad.data as any) ?? []);
    setAutoForecast((af.data as any) ?? []);
    setLoading(false);
  };

  const applyAutoForecast = async () => {
    if (autoForecast.length === 0) return toast.error('Keine Auto-Prognose vorhanden');
    const rows = autoForecast.map((r: any) => ({
      forecast_date: r.interval_start.slice(0, 10),
      channel: r.channel,
      interval_start: r.interval_start,
      predicted_volume: r.predicted_volume,
      predicted_aht_sec: 300,
      required_agents: r.required_agents,
    }));
    const { error } = await supabase.from('ac_wfm_forecasts').insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} Auto-Prognose-Intervalle übernommen`); load();
  };
  useEffect(() => { load(); }, []);

  const addShift = async () => {
    if (!agentId || !start || !end) return toast.error('Alle Felder ausfüllen');
    const { error } = await supabase.from('ac_wfm_shifts').insert({ agent_id: agentId, shift_start: start, shift_end: end });
    if (error) return toast.error(error.message);
    toast.success('Schicht angelegt'); setAgentId(''); setStart(''); setEnd(''); load();
  };

  const generateForecast = async () => {
    // Simple heuristic forecast for next 24h (30-min intervals) per channel
    const now = new Date(); now.setMinutes(0, 0, 0);
    const rows: any[] = [];
    for (let i = 0; i < 48; i++) {
      const t = new Date(now.getTime() + i * 30 * 60 * 1000);
      const hour = t.getHours();
      const peak = hour >= 9 && hour <= 17 ? 1 : 0.3;
      for (const ch of ['whatsapp', 'call', 'email']) {
        const vol = Math.round(20 * peak * (ch === 'call' ? 1.5 : ch === 'whatsapp' ? 1.2 : 0.8));
        const aht = ch === 'call' ? 420 : ch === 'whatsapp' ? 180 : 300;
        const req = Math.max(1, Math.ceil((vol * aht) / (1800 * 0.85)));
        rows.push({ forecast_date: t.toISOString().slice(0, 10), channel: ch, interval_start: t.toISOString(), predicted_volume: vol, predicted_aht_sec: aht, required_agents: req });
      }
    }
    const { error } = await supabase.from('ac_wfm_forecasts').insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} Prognose-Intervalle erzeugt`); load();
  };

  const autoSchedule = async () => {
    if (agents.length === 0) return toast.error('Keine Agenten gefunden');
    if (forecasts.length === 0) return toast.error('Erst Forecast erzeugen');
    // Gruppiere Bedarf pro Intervall, verteile round-robin auf Agents in 8h-Blöcken
    const byInterval = new Map<string, number>();
    forecasts.forEach(f => byInterval.set(f.interval_start, Math.max(byInterval.get(f.interval_start) ?? 0, f.required_agents)));
    const sorted = Array.from(byInterval.entries()).sort(([a], [b]) => a.localeCompare(b));
    const rows: any[] = [];
    let idx = 0;
    // Für jeden 4h-Block einen Schichtblock pro benötigtem Agent
    for (let i = 0; i < sorted.length; i += 8) {
      const block = sorted.slice(i, i + 8);
      if (block.length === 0) continue;
      const need = Math.max(...block.map(([, n]) => n));
      const startISO = block[0][0];
      const endISO = new Date(new Date(block[block.length - 1][0]).getTime() + 30 * 60 * 1000).toISOString();
      for (let k = 0; k < need; k++) {
        const agent = agents[(idx++) % agents.length];
        rows.push({ agent_id: agent.id, shift_start: startISO, shift_end: endISO, shift_type: 'auto', status: 'scheduled', notes: 'Auto-Scheduler' });
      }
    }
    if (rows.length === 0) return toast.error('Keine Schichten generiert');
    const { error } = await supabase.from('ac_wfm_shifts').insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} Schichten automatisch geplant`); load();
  };

  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? id.slice(0, 8);

  const kpi = useMemo(() => {
    const upcoming = shifts.filter(s => new Date(s.shift_start) > new Date()).length;
    const requiredNext = forecasts.slice(0, 2).reduce((s, f) => s + f.required_agents, 0);
    const totalVol = forecasts.slice(0, 48).reduce((s, f) => s + f.predicted_volume, 0);
    return { upcoming, requiredNext, totalVol };
  }, [shifts, forecasts]);

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Workforce Management <Badge variant="outline">Phase 25</Badge></h2>
          <p className="text-sm text-muted-foreground">Forecasting, Schichtplanung, Adherence.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generateForecast}><TrendingUp className="h-4 w-4 mr-1" />Forecast 24h</Button>
          <Button size="sm" variant="outline" onClick={applyAutoForecast}><Zap className="h-4 w-4 mr-1" />Auto-Forecast (30d)</Button>
          <Button size="sm" onClick={autoSchedule}><Calendar className="h-4 w-4 mr-1" />Auto-Scheduler</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Kommende Schichten</div><div className="text-2xl font-semibold">{kpi.upcoming}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Agenten-Bedarf jetzt (1h)</div><div className="text-2xl font-semibold">{kpi.requiredNext}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Prognostiziertes Volumen 24h</div><div className="text-2xl font-semibold">{kpi.totalVol}</div></Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> Neue Schicht</div>
        <div className="grid md:grid-cols-4 gap-2">
          <select className="border rounded px-2 py-1.5 text-sm bg-background" value={agentId} onChange={e => setAgentId(e.target.value)}>
            <option value="">Agent…</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
          <Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
          <Button onClick={addShift}>Hinzufügen</Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Calendar className="h-4 w-4" /> Schichten</div>
          {loading ? <div className="text-xs text-muted-foreground">Lade…</div> : shifts.length === 0 ? <div className="text-xs text-muted-foreground">Keine Schichten.</div> : (
            <div className="space-y-1 max-h-96 overflow-auto">
              {shifts.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs border-b py-1.5">
                  <div><div className="font-medium">{agentName(s.agent_id)}</div><div className="text-muted-foreground">{new Date(s.shift_start).toLocaleString('de-DE')} → {new Date(s.shift_end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div></div>
                  <Badge variant={s.status === 'scheduled' ? 'outline' : 'secondary'}>{s.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Activity className="h-4 w-4" /> Prognose (nächste Intervalle)</div>
          {forecasts.length === 0 ? <div className="text-xs text-muted-foreground">Kein Forecast vorhanden – oben erzeugen.</div> : (
            <div className="space-y-1 max-h-96 overflow-auto">
              {forecasts.slice(0, 24).map(f => (
                <div key={f.id} className="flex items-center justify-between text-xs border-b py-1.5">
                  <div><div className="font-medium">{new Date(f.interval_start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · {f.channel}</div><div className="text-muted-foreground">Vol {f.predicted_volume} · AHT {Math.round(f.predicted_aht_sec / 60)}m</div></div>
                  <Badge>{f.required_agents} Agents</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" /> Live-Adherence (letzte 24h)</div>
        {adherence.length === 0 ? <div className="text-xs text-muted-foreground">Keine Adherence-Daten – erfordert geplante Schichten und Presence-Events.</div> : (
          <div className="grid md:grid-cols-2 gap-2">
            {adherence.slice(0, 20).map((a: any) => (
              <div key={a.agent_id} className="border rounded p-2">
                <div className="flex justify-between text-xs mb-1"><span className="font-medium">{a.agent_name ?? a.agent_id?.slice(0,8)}</span><span>{a.adherence_pct}% · {a.actual_minutes}/{a.scheduled_minutes} min</span></div>
                <div className="h-2 bg-muted rounded"><div className={`h-2 rounded ${Number(a.adherence_pct) >= 80 ? 'bg-green-500' : Number(a.adherence_pct) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Number(a.adherence_pct))}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
