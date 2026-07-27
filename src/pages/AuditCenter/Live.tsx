import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, Radio } from "lucide-react";
import { logAuditAccess } from "./audit-access";

export default function AuditLive() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  const load = async () => {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [s, a] = await Promise.all([
      supabase
        .from("audit_sessions")
        .select("id, user_id, started_at, last_heartbeat_at, device_id, meta")
        .is("ended_at", null)
        .gte("last_heartbeat_at", since)
        .order("last_heartbeat_at", { ascending: false })
        .limit(200),
      supabase
        .from("audit_actions")
        .select("id, ts, user_id, module, action, path")
        .order("ts", { ascending: false })
        .limit(30),
    ]);
    setSessions(s.data ?? []);
    setRecent(a.data ?? []);
  };

  useEffect(() => {
    logAuditAccess("live");
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
            Live-Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aktive Sessions & Aktionen in Echtzeit (5s Refresh)
          </p>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 gap-2">
          <Radio className="h-3 w-3 animate-pulse" /> LIVE
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-6 w-6 text-emerald-400" />
            <div>
              <div className="text-2xl font-semibold">{sessions.length}</div>
              <div className="text-xs text-muted-foreground">Aktive Sessions</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-6 w-6 text-amber-400" />
            <div>
              <div className="text-2xl font-semibold">
                {new Set(sessions.map((s) => s.user_id)).size}
              </div>
              <div className="text-xs text-muted-foreground">Unique Benutzer</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <Radio className="h-6 w-6 text-sky-400" />
            <div>
              <div className="text-2xl font-semibold">
                {new Set(sessions.map((s) => s.device_id)).size}
              </div>
              <div className="text-xs text-muted-foreground">Geräte</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Aktive Sessions</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="text-left px-4 py-2">Benutzer</th>
                  <th className="text-left px-4 py-2">Start</th>
                  <th className="text-left px-4 py-2">Letzter Beat</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-border/30">
                    <td className="px-4 py-2 text-xs">{s.user_id?.slice(0, 8) ?? "—"}…</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {new Date(s.started_at).toLocaleTimeString("de-DE")}
                    </td>
                    <td className="px-4 py-2 text-emerald-300 text-xs">
                      {s.last_heartbeat_at ? new Date(s.last_heartbeat_at).toLocaleTimeString("de-DE") : "—"}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Keine aktiven Sessions</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Letzte Aktionen</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="text-left px-4 py-2">Zeit</th>
                  <th className="text-left px-4 py-2">Modul</th>
                  <th className="text-left px-4 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(r.ts).toLocaleTimeString("de-DE")}
                    </td>
                    <td className="px-4 py-2">{r.module}</td>
                    <td className="px-4 py-2 text-xs">{r.action}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">—</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
