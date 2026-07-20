import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AlixConnectAdmin() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<{ contacts: number; convs: number; msgs: number; campaigns: number }>({
    contacts: 0, convs: 0, msgs: 0, campaigns: 0,
  });

  useEffect(() => {
    (async () => {
      const [{ data: profs }, c1, c2, c3, c4] = await Promise.all([
        supabase.from("user_profiles").select("id, email, first_name, last_name, status").order("created_at", { ascending: false }).limit(100),
        supabase.from("ac_contacts").select("id", { count: "exact", head: true }),
        supabase.from("ac_conversations").select("id", { count: "exact", head: true }),
        supabase.from("ac_messages").select("id", { count: "exact", head: true }),
        supabase.from("ac_campaigns").select("id", { count: "exact", head: true }),
      ]);
      setUsers(profs ?? []);
      setStats({ contacts: c1.count ?? 0, convs: c2.count ?? 0, msgs: c3.count ?? 0, campaigns: c4.count ?? 0 });
    })();
  }, []);

  const filtered = users.filter((u) => {
    const s = q.toLowerCase();
    return !s || u.email?.toLowerCase().includes(s) || `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase().includes(s);
  });

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Admin Console
          <Badge variant="outline" className="ml-2">Phase 9</Badge>
        </h2>
        <p className="text-sm text-muted-foreground">Team-Übersicht, Quoten und Compliance für ALIX CONNECT.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Kontakte", v: stats.contacts },
          { l: "Konversationen", v: stats.convs },
          { l: "Nachrichten", v: stats.msgs },
          { l: "Kampagnen", v: stats.campaigns },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1">{k.v}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" /> Team ({filtered.length})
          </div>
          <Input className="max-w-xs" placeholder="Suche…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="overflow-hidden rounded border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">E-Mail</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="p-2">{`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "—"}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    <Badge variant={u.status === "active" ? "default" : "outline"}>{u.status || "—"}</Badge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Keine Benutzer.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
