import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity, Clock, Monitor, MapPin } from "lucide-react";
import { logAuditAccess } from "./audit-access";

export default function AuditEmployeeDetail() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [geo, setGeo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    logAuditAccess("employee-detail", {}, userId);
    (async () => {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const [p, a, s, d, g] = await Promise.all([
        supabase.from("user_profiles").select("id, email, full_name, role").eq("id", userId).maybeSingle(),
        supabase.from("audit_actions").select("*").eq("user_id", userId).gte("ts", since).order("ts", { ascending: false }).limit(500),
        supabase.from("audit_sessions").select("*").eq("user_id", userId).gte("started_at", since).order("started_at", { ascending: false }).limit(100),
        supabase.from("audit_devices").select("*").eq("user_id", userId).limit(20),
        supabase.from("audit_geo").select("*").eq("user_id", userId).order("id", { ascending: false }).limit(20),
      ]);
      setProfile(p.data);
      setActions(a.data ?? []);
      setSessions(s.data ?? []);
      setDevices(d.data ?? []);
      setGeo(g.data ?? []);
      setLoading(false);
    })();
  }, [userId]);

  const totalActions = actions.length;
  const totalMinutes = sessions.reduce((s, r) => s + (r.active_seconds ?? 0), 0) / 60;
  const uniqueModules = new Set(actions.map((a) => a.module).filter(Boolean)).size;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link to="/audit-center/employees">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
          {profile?.full_name || profile?.email || userId?.slice(0, 8)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{profile?.email} · {profile?.role} · Letzte 90 Tage</p>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl"><CardContent className="p-4"><Activity className="h-5 w-5 text-emerald-400 mb-2" /><div className="text-2xl font-semibold">{totalActions}</div><div className="text-xs text-muted-foreground">Aktionen</div></CardContent></Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl"><CardContent className="p-4"><Clock className="h-5 w-5 text-sky-400 mb-2" /><div className="text-2xl font-semibold">{Math.round(totalMinutes)}</div><div className="text-xs text-muted-foreground">Aktive Minuten</div></CardContent></Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl"><CardContent className="p-4"><Monitor className="h-5 w-5 text-amber-400 mb-2" /><div className="text-2xl font-semibold">{devices.length}</div><div className="text-xs text-muted-foreground">Geräte</div></CardContent></Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl"><CardContent className="p-4"><MapPin className="h-5 w-5 text-rose-400 mb-2" /><div className="text-2xl font-semibold">{new Set(geo.map((g) => g.country)).size}</div><div className="text-xs text-muted-foreground">Länder</div></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Letzte Sessions</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/60 sticky top-0 bg-card"><tr><th className="text-left px-4 py-2">Start</th><th className="text-left px-4 py-2">Dauer</th><th className="text-left px-4 py-2">Klicks</th></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-border/30">
                    <td className="px-4 py-2 text-xs">{new Date(s.started_at).toLocaleString("de-DE")}</td>
                    <td className="px-4 py-2 text-xs">{Math.round((s.active_seconds ?? 0) / 60)} min</td>
                    <td className="px-4 py-2 text-xs">{s.click_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Geräte & Standorte</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {devices.map((d) => (
              <div key={d.id} className="text-xs p-2 rounded bg-muted/30 border border-border/30">
                <div className="font-medium">{d.browser} {d.browser_version} · {d.os}</div>
                <div className="text-muted-foreground">{d.screen_resolution} · {d.language}</div>
              </div>
            ))}
            {geo.slice(0, 5).map((g) => (
              <div key={g.id} className="text-xs p-2 rounded bg-muted/30 border border-border/30 flex items-center gap-2">
                <MapPin className="h-3 w-3 text-rose-400" />
                <span>{[g.city, g.country].filter(Boolean).join(", ") || "—"}</span>
                {g.vpn_detected && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-300 border-red-500/30">VPN</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Aktivitäts-Timeline</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60 sticky top-0 bg-card"><tr><th className="text-left px-4 py-2">Zeit</th><th className="text-left px-4 py-2">Modul</th><th className="text-left px-4 py-2">Aktion</th><th className="text-left px-4 py-2">Pfad</th></tr></thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} className="border-b border-border/30">
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(a.ts).toLocaleString("de-DE")}</td>
                  <td className="px-4 py-2 text-xs">{a.module}</td>
                  <td className="px-4 py-2 text-xs">{a.action}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[240px]">{a.path}</td>
                </tr>
              ))}
              {!loading && actions.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Keine Aktionen</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
