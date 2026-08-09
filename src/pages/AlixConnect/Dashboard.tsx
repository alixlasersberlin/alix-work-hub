import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { MessageSquare, Users, Send, Eye, Inbox as InboxIcon, Megaphone } from "lucide-react";

type KPI = { label: string; value: number | string; icon: any; hint?: string };

export default function AlixConnectDashboard() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const { tenantId } = useTenantFilter();

  useEffect(() => {
    (async () => {
      // Eine Server-Abfrage statt sechs parallelen Count-Queries.
      const { data } = await supabase.rpc("ac_dashboard_kpis" as any, { p_tenant_id: tenantId });
      const k = (data ?? {}) as Record<string, number>;
      setKpis([
        { label: "Nachrichten (7T)", value: Number(k.messages || 0), icon: MessageSquare },
        { label: "Neue Conversations (7T)", value: Number(k.convs || 0), icon: InboxIcon },
        { label: "Kontakte gesamt", value: Number(k.contacts || 0), icon: Users },
        { label: "Pageviews / Events (7T)", value: Number(k.events || 0), icon: Eye, hint: "cookieless" },
        { label: "Kampagnen", value: Number(k.campaigns || 0), icon: Megaphone },
        { label: "Offene im Inbox", value: Number(k.openInbox || 0), icon: Send },
      ]);
      setLoading(false);
    })();
  }, [tenantId]);

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
