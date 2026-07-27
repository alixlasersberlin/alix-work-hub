import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, Clock, Monitor } from "lucide-react";
import { logAuditAccess } from "./audit-access";

export default function AuditOverview() {
  const [stats, setStats] = useState({
    activeSessions: 0,
    todaySessions: 0,
    todayActions: 0,
    devices: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logAuditAccess("overview");
    (async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const iso = today.toISOString();
      const [openS, todayS, todayA, devs, latest] = await Promise.all([
        supabase.from("audit_sessions").select("id", { count: "exact", head: true }).is("ended_at", null),
        supabase.from("audit_sessions").select("id", { count: "exact", head: true }).gte("started_at", iso),
        supabase.from("audit_actions").select("id", { count: "exact", head: true }).gte("ts", iso),
        supabase.from("audit_devices").select("device_id", { count: "exact", head: true }),
        supabase.from("audit_sessions")
          .select("id, user_email, started_at, ended_at, active_seconds, idle_seconds, click_count, keystroke_count, device_id")
          .order("started_at", { ascending: false }).limit(20),
      ]);
      setStats({
        activeSessions: openS.count ?? 0,
        todaySessions: todayS.count ?? 0,
        todayActions: todayA.count ?? 0,
        devices: devs.count ?? 0,
      });
      setRecent(latest.data ?? []);
      setLoading(false);
    })();
  }, []);

  const kpis = [
    { label: "Aktive Sitzungen", value: stats.activeSessions, icon: Activity, tint: "from-emerald-500 to-teal-500" },
    { label: "Sitzungen heute", value: stats.todaySessions, icon: Users, tint: "from-amber-400 to-yellow-500" },
    { label: "Aktionen heute", value: stats.todayActions, icon: Clock, tint: "from-blue-500 to-indigo-500" },
    { label: "Bekannte Geräte", value: stats.devices, icon: Monitor, tint: "from-fuchsia-500 to-pink-500" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
          Audit Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revisionssichere Protokolle · 24 Monate Aufbewahrung · WORM · Zugriff nur Super Admin
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-border/60 bg-card/40 backdrop-blur-xl overflow-hidden relative">
            <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${k.tint}`} />
            <CardHeader className="pb-2 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</CardTitle>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-semibold">{loading ? "…" : k.value.toLocaleString("de-DE")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-sm">Letzte Sitzungen</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-2">Start</th>
                <th className="text-left px-4 py-2">Benutzer</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Aktiv</th>
                <th className="text-right px-4 py-2">Idle</th>
                <th className="text-right px-4 py-2">Klicks</th>
                <th className="text-right px-4 py-2">Tasten</th>
                <th className="text-left px-4 py-2">Gerät</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b border-border/30">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(r.started_at).toLocaleString("de-DE")}</td>
                  <td className="px-4 py-2">{r.user_email ?? "—"}</td>
                  <td className="px-4 py-2">
                    {r.ended_at
                      ? <Badge variant="secondary">beendet</Badge>
                      : <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">aktiv</Badge>}
                  </td>
                  <td className="px-4 py-2 text-right">{Math.round((r.active_seconds ?? 0) / 60)}m</td>
                  <td className="px-4 py-2 text-right">{Math.round((r.idle_seconds ?? 0) / 60)}m</td>
                  <td className="px-4 py-2 text-right">{r.click_count ?? 0}</td>
                  <td className="px-4 py-2 text-right">{r.keystroke_count ?? 0}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[220px]">{r.device_id ?? "—"}</td>
                </tr>
              ))}
              {!loading && recent.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Noch keine Sitzungen erfasst</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-4 text-xs text-muted-foreground">
          <strong className="text-amber-400">Phase 1</strong> — Fundament aktiv: Login-Protokoll, Session-Tracking (aktiv/idle),
          Klick/Tasten-Zähler, Geo/Device/IP, sekundengenaue Timeline. Phasen 2–5 (Kunden-/Doku-/KI-Log,
          Sicherheitscenter, Live-Monitor mit Realtime, UPS-Score) folgen in weiteren Prompts.
        </CardContent>
      </Card>
    </div>
  );
}
