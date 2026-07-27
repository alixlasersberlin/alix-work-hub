import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Activity, Clock, Monitor } from "lucide-react";
import { logAuditAccess } from "./audit-access";

type EmpRow = {
  user_id: string;
  email?: string | null;
  name?: string | null;
  actions: number;
  sessions: number;
  devices: number;
  last_seen?: string | null;
  modules: Set<string>;
};

export default function AuditEmployees() {
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logAuditAccess("employees");
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [actionsRes, sessionsRes, profilesRes] = await Promise.all([
        supabase
          .from("audit_actions")
          .select("user_id, module, ts")
          .gte("ts", since)
          .limit(10000),
        supabase
          .from("audit_sessions")
          .select("user_id, device_id, last_heartbeat_at")
          .gte("started_at", since)
          .limit(5000),
        supabase.from("user_profiles").select("id, email, full_name").limit(500),
      ]);

      const map = new Map<string, EmpRow>();
      const upsert = (uid: string): EmpRow => {
        let r = map.get(uid);
        if (!r) {
          r = { user_id: uid, actions: 0, sessions: 0, devices: 0, modules: new Set() };
          map.set(uid, r);
        }
        return r;
      };
      (actionsRes.data ?? []).forEach((a: any) => {
        if (!a.user_id) return;
        const r = upsert(a.user_id);
        r.actions++;
        if (a.module) r.modules.add(a.module);
        if (!r.last_seen || a.ts > r.last_seen) r.last_seen = a.ts;
      });
      const devSeen = new Map<string, Set<string>>();
      (sessionsRes.data ?? []).forEach((s: any) => {
        if (!s.user_id) return;
        const r = upsert(s.user_id);
        r.sessions++;
        if (s.device_id) {
          if (!devSeen.has(s.user_id)) devSeen.set(s.user_id, new Set());
          devSeen.get(s.user_id)!.add(s.device_id);
        }
      });
      devSeen.forEach((d, uid) => {
        const r = map.get(uid);
        if (r) r.devices = d.size;
      });
      (profilesRes.data ?? []).forEach((p: any) => {
        const r = map.get(p.id);
        if (r) {
          r.email = p.email;
          r.name = p.full_name;
        }
      });

      const list = Array.from(map.values()).sort((a, b) => b.actions - a.actions);
      setRows(list);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.email?.toLowerCase().includes(s) ||
        r.name?.toLowerCase().includes(s) ||
        r.user_id.toLowerCase().includes(s),
    );
  }, [rows, q]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
            Mitarbeiter-Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Aktivitätsübersicht der letzten 30 Tage</p>
        </div>
        <Input placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.slice(0, 60).map((r) => (
          <Link key={r.user_id} to={`/audit-center/employees/${r.user_id}`} className="block">
          <Card className="border-border/60 bg-card/40 backdrop-blur-xl hover:border-amber-500/40 cursor-pointer transition h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-amber-400" />
                <span className="truncate">{r.name || r.email || r.user_id.slice(0, 8)}</span>
              </CardTitle>
              {r.email && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold flex items-center justify-center gap-1">
                    <Activity className="h-3 w-3 text-emerald-400" />
                    {r.actions}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">Aktionen</div>
                </div>
                <div>
                  <div className="text-lg font-semibold flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3 text-sky-400" />
                    {r.sessions}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">Sessions</div>
                </div>
                <div>
                  <div className="text-lg font-semibold flex items-center justify-center gap-1">
                    <Monitor className="h-3 w-3 text-amber-400" />
                    {r.devices}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">Geräte</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(r.modules).slice(0, 6).map((m) => (
                  <Badge key={m} variant="outline" className="text-[10px] bg-amber-500/5 border-amber-500/20">
                    {m}
                  </Badge>
                ))}
              </div>
              {r.last_seen && (
                <p className="text-[11px] text-muted-foreground">
                  Zuletzt aktiv: {new Date(r.last_seen).toLocaleString("de-DE")}
                </p>
              )}
            </CardContent>
          </Card>
          </Link>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">Keine Mitarbeiter gefunden</p>
        )}
      </div>
    </div>
  );
}
