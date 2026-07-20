import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { MessageSquare, Users, Send, Eye, Inbox as InboxIcon, Megaphone } from "lucide-react";

type KPI = { label: string; value: number | string; icon: any; hint?: string };

export default function AlixConnectDashboard() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const [msgs, convs, contacts, events, campaigns, openInbox] = await Promise.all([
        supabase.from("ac_messages").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("ac_conversations").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("ac_contacts").select("id", { count: "exact", head: true }),
        supabase.from("ac_analytics_events").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("ac_campaigns").select("id", { count: "exact", head: true }),
        supabase.from("ac_conversations").select("id", { count: "exact", head: true }).in("status", ["open", "pending"]),
      ]);
      setKpis([
        { label: "Nachrichten (7T)", value: msgs.count ?? 0, icon: MessageSquare },
        { label: "Neue Conversations (7T)", value: convs.count ?? 0, icon: InboxIcon },
        { label: "Kontakte gesamt", value: contacts.count ?? 0, icon: Users },
        { label: "Pageviews / Events (7T)", value: events.count ?? 0, icon: Eye, hint: "cookieless" },
        { label: "Kampagnen", value: campaigns.count ?? 0, icon: Megaphone },
        { label: "Offene im Inbox", value: openInbox.count ?? 0, icon: Send },
      ]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Zentraler Überblick über alle Kanäle, Kontakte und Kampagnen.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4 border-border/60">
            <div className="flex items-center justify-between">
              <k.icon className="h-4 w-4 text-muted-foreground" />
              {k.hint && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.hint}</span>}
            </div>
            <div className="mt-3 text-2xl font-bold tabular-nums">{loading ? "…" : k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.label}</div>
          </Card>
        ))}
      </div>
      <Card className="p-6 border-border/60">
        <h3 className="text-sm font-semibold mb-2">Roadmap</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>✅ Phase 1 — Architektur &amp; Team Chat</li>
          <li>✅ Phase 2 — Website Chat &amp; cookieless Tracking</li>
          <li>✅ Phase 3 — WhatsApp / Twilio / Meta</li>
          <li>✅ Phase 4 — CRM &amp; Kampagnen</li>
          <li>✅ Phase 5 — Portal &amp; Dashboard</li>
          <li>✅ Phase 6 — AI Agents, Surveys, PWA</li>
          <li>🚧 Phase 7-10 — Automation, Reporting, Admin-Console, Mobile (Stubs)</li>
        </ul>
      </Card>
    </div>
  );
}
