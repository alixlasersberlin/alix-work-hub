import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Phone, PhoneMissed, Voicemail, Timer } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";

type Call = {
  id: string; direction: string; status: string;
  agent_user_id: string | null; from_number: string | null; to_number: string | null;
  started_at: string; answered_at: string | null; ended_at: string | null;
  duration_seconds: number | null; voicemail_url: string | null;
};

const RANGES = { "7": "Letzte 7 Tage", "30": "Letzte 30 Tage", "90": "Letzte 90 Tage" };
const COLORS = ["#d4af37", "#8b7355", "#c0392b", "#2ecc71", "#3498db"];

export default function TelephonyAnalytics() {
  const [range, setRange] = useState<keyof typeof RANGES>("30");
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - parseInt(range) * 86400000).toISOString();
      const { data } = await supabase
        .from("ac_calls")
        .select("id,direction,status,agent_user_id,from_number,to_number,started_at,answered_at,ended_at,duration_seconds,voicemail_url")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(5000);
      setCalls((data || []) as Call[]);
      setLoading(false);
    })();
  }, [range]);

  const stats = useMemo(() => {
    const total = calls.length;
    const missed = calls.filter(c => c.status === "missed" || c.status === "no_answer").length;
    const voicemail = calls.filter(c => c.voicemail_url).length;
    const durations = calls.map(c => c.duration_seconds || 0).filter(d => d > 0);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    return { total, missed, voicemail, avg };
  }, [calls]);

  const perDay = useMemo(() => {
    const map = new Map<string, { day: string; inbound: number; outbound: number; missed: number }>();
    for (const c of calls) {
      const day = c.started_at.slice(0, 10);
      const row = map.get(day) || { day, inbound: 0, outbound: 0, missed: 0 };
      if (c.direction === "inbound") row.inbound++;
      else row.outbound++;
      if (c.status === "missed" || c.status === "no_answer") row.missed++;
      map.set(day, row);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [calls]);

  const perAgent = useMemo(() => {
    const map = new Map<string, { agent: string; calls: number; avg: number; total: number }>();
    for (const c of calls) {
      const key = c.agent_user_id?.slice(0, 8) || "—";
      const row = map.get(key) || { agent: key, calls: 0, avg: 0, total: 0 };
      row.calls++;
      row.total += c.duration_seconds || 0;
      map.set(key, row);
    }
    return Array.from(map.values()).map(r => ({ ...r, avg: r.calls ? Math.round(r.total / r.calls) : 0 })).sort((a, b) => b.calls - a.calls).slice(0, 10);
  }, [calls]);

  const statusDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of calls) map.set(c.status, (map.get(c.status) || 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [calls]);

  const exportCsv = () => {
    const header = "id,direction,status,agent,from,to,started_at,duration_seconds,voicemail\n";
    const rows = calls.map(c =>
      [c.id, c.direction, c.status, c.agent_user_id || "", c.from_number || "", c.to_number || "", c.started_at, c.duration_seconds || 0, c.voicemail_url ? "1" : "0"]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `telephony-${range}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call-Analytics & Reports</h1>
          <p className="text-muted-foreground">3CX Anrufauswertung, Agent-Performance und CSV-Export.</p>
        </div>
        <div className="flex gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RANGES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={exportCsv} disabled={!calls.length}><Download className="mr-2 h-4 w-4" /> CSV Export</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<Phone className="h-4 w-4" />} label="Anrufe gesamt" value={stats.total} />
        <StatCard icon={<PhoneMissed className="h-4 w-4 text-destructive" />} label="Verpasst" value={stats.missed} sub={stats.total ? `${Math.round(stats.missed / stats.total * 100)}% Missed-Rate` : ""} />
        <StatCard icon={<Voicemail className="h-4 w-4" />} label="Voicemails" value={stats.voicemail} />
        <StatCard icon={<Timer className="h-4 w-4" />} label="Ø Dauer" value={`${Math.floor(stats.avg / 60)}m ${stats.avg % 60}s`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Anrufvolumen pro Tag</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={perDay}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Line type="monotone" dataKey="inbound" stroke="#d4af37" strokeWidth={2} />
                <Line type="monotone" dataKey="outbound" stroke="#3498db" strokeWidth={2} />
                <Line type="monotone" dataKey="missed" stroke="#c0392b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status-Verteilung</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top Agenten</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perAgent}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="agent" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Bar dataKey="calls" fill="#d4af37" name="Anrufe" />
              <Bar dataKey="avg" fill="#8b7355" name="Ø Dauer (s)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {loading && <p className="text-center text-sm text-muted-foreground">Lade…</p>}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
        <div className="mt-2 text-3xl font-bold">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
