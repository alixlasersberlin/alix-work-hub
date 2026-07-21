import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, Calendar, Activity } from 'lucide-react';
import { toast } from 'sonner';

type Shift = { id: string; agent_id: string; shift_start: string; shift_end: string; shift_type: string; status: string; notes: string | null };
type Forecast = { id: string; forecast_date: string; channel: string; interval_start: string; predicted_volume: number; predicted_aht_sec: number; required_agents: number };

export default function AlixConnectWfm() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const load = async () => {
    setLoading(true);
    const [s, f, a] = await Promise.all([
      supabase.from('ac_wfm_shifts').select('*').order('shift_start', { ascending: false }).limit(50),
      supabase.from('ac_wfm_forecasts').select('*').order('interval_start', { ascending: true }).limit(48),
      supabase.from('user_profiles').select('id, full_name').limit(200),
    ]);
    setShifts((s.data as any) ?? []);
    setForecasts((f.data as any) ?? []);
    setAgents(((a.data as any) ?? []).map((u: any) => ({ id: u.id, name: u.full_name ?? u.id })));
    setLoading(false);
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
        <Button size="sm" onClick={generateForecast}><TrendingUp className="h-4 w-4 mr-1" />Forecast 24h erzeugen</Button>
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
    </div>
  );
}
