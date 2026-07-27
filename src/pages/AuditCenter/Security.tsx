import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, Clock, Globe, KeyRound } from "lucide-react";
import { logAuditAccess } from "./audit-access";

type Alert = {
  id: string;
  ts: string;
  severity: "low" | "medium" | "high" | "critical";
  kind: string;
  user_id?: string | null;
  detail: string;
  meta?: Record<string, any>;
};

const SEV_STYLES: Record<Alert["severity"], string> = {
  low: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/10 text-red-300 border-red-500/30",
};

export default function AuditSecurity() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logAuditAccess("security");
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [actionsRes, sessionsRes, accessRes] = await Promise.all([
        supabase
          .from("audit_actions")
          .select("id, ts, user_id, module, action, object_type, object_id, path, meta")
          .gte("ts", since)
          .order("ts", { ascending: false })
          .limit(2000),
        supabase
          .from("audit_sessions")
          .select("id, user_id, started_at, ended_at, device_id, meta")
          .gte("started_at", since)
          .order("started_at", { ascending: false })
          .limit(1000),
        supabase
          .from("audit_access_log")
          .select("id, ts, user_id, page, meta")
          .gte("ts", since)
          .order("ts", { ascending: false })
          .limit(500),
      ]);

      const list: Alert[] = [];
      const actions = actionsRes.data ?? [];
      const sessions = sessionsRes.data ?? [];
      const access = accessRes.data ?? [];

      // 1) Off-Hours Aktivität (22:00 – 06:00 lokal)
      actions.forEach((a: any) => {
        const h = new Date(a.ts).getHours();
        if (h >= 22 || h < 6) {
          list.push({
            id: `oh-${a.id}`,
            ts: a.ts,
            severity: "low",
            kind: "Off-Hours",
            user_id: a.user_id,
            detail: `${a.module ?? "?"} · ${a.action ?? "?"} um ${new Date(a.ts).toLocaleTimeString("de-DE")}`,
          });
        }
      });

      // 2) Multi-Device: gleicher User, >2 Devices in 24h
      const devByUser = new Map<string, Set<string>>();
      sessions.forEach((s: any) => {
        if (!s.user_id || !s.device_id) return;
        if (!devByUser.has(s.user_id)) devByUser.set(s.user_id, new Set());
        devByUser.get(s.user_id)!.add(s.device_id);
      });
      devByUser.forEach((devs, uid) => {
        if (devs.size >= 3) {
          list.push({
            id: `md-${uid}`,
            ts: new Date().toISOString(),
            severity: "medium",
            kind: "Multi-Device",
            user_id: uid,
            detail: `${devs.size} unterschiedliche Geräte in 7 Tagen`,
          });
        }
      });

      // 3) Delete-Storm: >10 delete actions eines Users in 1h
      const delBuckets = new Map<string, number>();
      actions.forEach((a: any) => {
        if (!/delete|remove/i.test(a.action ?? "")) return;
        const bucket = `${a.user_id}-${a.ts.slice(0, 13)}`;
        delBuckets.set(bucket, (delBuckets.get(bucket) ?? 0) + 1);
      });
      delBuckets.forEach((count, key) => {
        if (count >= 10) {
          const [uid, hour] = key.split(/-(.*)/);
          list.push({
            id: `ds-${key}`,
            ts: `${hour}:00:00Z`,
            severity: "high",
            kind: "Delete-Storm",
            user_id: uid,
            detail: `${count} Löschungen in einer Stunde`,
          });
        }
      });

      // 4) Sensible Bereiche: Zugriffe auf /audit-center, /admin, /rollen
      access.forEach((a: any) => {
        if (!a.page) return;
        if (/audit-center|admin|rollen|super/i.test(a.page)) {
          list.push({
            id: `sa-${a.id}`,
            ts: a.ts,
            severity: "medium",
            kind: "Sensibler Zugriff",
            user_id: a.user_id,
            detail: `Öffnete ${a.page}`,
          });
        }
      });

      // Sortieren nach Severity, dann Zeit
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      list.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || b.ts.localeCompare(a.ts));

      setAlerts(list);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const s = { critical: 0, high: 0, medium: 0, low: 0 };
    alerts.forEach((a) => s[a.severity]++);
    return s;
  }, [alerts]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
          Sicherheits-Alerts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automatisch erkannte Anomalien der letzten 7 Tage
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Kritisch", v: stats.critical, i: ShieldAlert, c: "text-red-400" },
          { l: "Hoch", v: stats.high, i: AlertTriangle, c: "text-orange-400" },
          { l: "Mittel", v: stats.medium, i: KeyRound, c: "text-amber-400" },
          { l: "Niedrig", v: stats.low, i: Clock, c: "text-blue-400" },
        ].map(({ l, v, i: Icon, c }) => (
          <Card key={l} className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-6 w-6 ${c}`} />
              <div>
                <div className="text-2xl font-semibold">{v}</div>
                <div className="text-xs text-muted-foreground">{l}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" /> {alerts.length} Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-2">Zeit</th>
                <th className="text-left px-4 py-2">Severity</th>
                <th className="text-left px-4 py-2">Typ</th>
                <th className="text-left px-4 py-2">Benutzer</th>
                <th className="text-left px-4 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 200).map((a) => (
                <tr key={a.id} className="border-b border-border/30">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(a.ts).toLocaleString("de-DE")}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={SEV_STYLES[a.severity]}>
                      {a.severity}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-medium">{a.kind}</td>
                  <td className="px-4 py-2 text-xs">{a.user_id?.slice(0, 8) ?? "—"}…</td>
                  <td className="px-4 py-2 text-muted-foreground">{a.detail}</td>
                </tr>
              ))}
              {!loading && alerts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Keine Anomalien erkannt
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
