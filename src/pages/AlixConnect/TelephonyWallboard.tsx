import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Voicemail, PhoneCall, Clock, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type Call = {
  id: string; direction: string; status: string;
  from_number: string | null; to_number: string | null;
  extension: string | null; started_at: string; answered_at: string | null;
  ended_at: string | null; duration_seconds: number | null;
};

export default function TelephonyWallboard() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [today, setToday] = useState({ total: 0, answered: 0, missed: 0, voicemail: 0, avgDuration: 0 });

  const load = async () => {
    const { data: live } = await supabase.from("ac_calls").select("*")
      .in("status", ["ringing", "in_progress", "answered"])
      .order("started_at", { ascending: false }).limit(50);
    setCalls((live ?? []) as Call[]);

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { data: dayCalls } = await supabase.from("ac_calls").select("status,duration_seconds")
      .gte("started_at", startOfDay.toISOString());
    const d = dayCalls ?? [];
    const answered = d.filter((c: any) => c.status === "answered" || c.status === "ended").length;
    const missed = d.filter((c: any) => c.status === "missed").length;
    const voicemail = d.filter((c: any) => c.status === "voicemail").length;
    const durations = d.map((c: any) => c.duration_seconds).filter((x: any) => x > 0);
    const avg = durations.length ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0;
    setToday({ total: d.length, answered, missed, voicemail, avgDuration: avg });
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("wallboard").on("postgres_changes",
      { event: "*", schema: "public", table: "ac_calls" }, () => load()).subscribe();
    const int = setInterval(load, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(int); };
  }, []);

  const statusColor = (s: string) => s === "ringing" ? "bg-amber-500/20 text-amber-500 border-amber-500/30"
    : s === "in_progress" || s === "answered" ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
    : "bg-muted";

  const fmtDur = (s: number) => {
    if (!s) return "-";
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Wallboard · Live-Queue</h1>
        <p className="text-muted-foreground">Echtzeit-Übersicht aller Telefonie-Aktivitäten (3CX)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Kpi label="Heute gesamt" value={today.total} icon={<PhoneCall className="h-5 w-5" />} />
        <Kpi label="Angenommen" value={today.answered} icon={<PhoneIncoming className="h-5 w-5 text-emerald-500" />} />
        <Kpi label="Verpasst" value={today.missed} icon={<PhoneMissed className="h-5 w-5 text-red-500" />} />
        <Kpi label="Voicemail" value={today.voicemail} icon={<Voicemail className="h-5 w-5 text-amber-500" />} />
        <Kpi label="Ø Dauer" value={fmtDur(today.avgDuration)} icon={<Clock className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Aktive Anrufe ({calls.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Aktuell keine aktiven Anrufe.</p>
          ) : (
            <div className="space-y-2">
              {calls.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3">
                    {c.direction === "inbound" ? <PhoneIncoming className="h-5 w-5 text-emerald-500" /> : <PhoneOutgoing className="h-5 w-5 text-blue-500" />}
                    <div>
                      <div className="font-medium">{c.direction === "inbound" ? c.from_number : c.to_number}</div>
                      <div className="text-xs text-muted-foreground">
                        Ext {c.extension ?? "-"} · seit {formatDistanceToNow(new Date(c.started_at), { locale: de, addSuffix: false })}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusColor(c.status)}>{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
