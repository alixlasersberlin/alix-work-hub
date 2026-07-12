import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Inbox, User, Clock, AlertTriangle, CalendarDays, PauseCircle, Flame } from "lucide-react";

type Counts = {
  neu: number;
  meine: number;
  heute: number;
  ueberfaellig: number;
  termine_heute: number;
  warten_kunde: number;
  eskaliert: number;
};

const OPEN_STATUS = ["Neu", "Zugewiesen", "In Bearbeitung", "offen", "in_bearbeitung"];

export default function TicketsDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const c = (q: any) => q.then((r: any) => r.count ?? 0);

      const [neu, meine, heute, ueberfaellig, termine_heute, warten_kunde, eskaliert] = await Promise.all([
        c(supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "Neu")),
        c(supabase.from("tickets").select("id", { count: "exact", head: true })
          .eq("assigned_to", user?.id ?? "").in("status", OPEN_STATUS)),
        c(supabase.from("tickets").select("id", { count: "exact", head: true })
          .gte("due_at", start).lt("due_at", end).in("status", OPEN_STATUS)),
        c(supabase.from("tickets").select("id", { count: "exact", head: true })
          .lt("due_at", new Date().toISOString()).in("status", OPEN_STATUS)),
        c(supabase.from("tickets").select("id", { count: "exact", head: true })
          .gte("appointment_at", start).lt("appointment_at", end)),
        c(supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "Warten auf Kunde")),
        c(supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "Eskaliert")),
      ]);
      setCounts({ neu, meine, heute, ueberfaellig, termine_heute, warten_kunde, eskaliert });
      setLoading(false);
    })();
  }, [user?.id]);

  const tile = (label: string, value: number, Icon: any, to: string, tone?: string) => (
    <Link to={to}>
      <Card className="hover:shadow-md transition">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
          <Icon className={`w-4 h-4 ${tone ?? "text-muted-foreground"}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-semibold ${tone ?? ""}`}>{value}</div>
        </CardContent>
      </Card>
    </Link>
  );

  if (loading || !counts) {
    return <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tickets-Übersicht</h1>
          <p className="text-sm text-muted-foreground">Alle offenen Tickets, Fristen und Termine auf einen Blick.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/tickets"><Badge variant="outline">Alle Tickets</Badge></Link>
          <Link to="/esc/buchungen"><Badge variant="outline">Kalender</Badge></Link>
          <Link to="/operation/ticket-abteilungen"><Badge variant="outline">Abteilungen</Badge></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tile("Neue Tickets", counts.neu, Inbox, "/tickets?status=Neu")}
        {tile("Meine offenen", counts.meine, User, "/tickets?mine=1")}
        {tile("Heute fällig", counts.heute, Clock, "/tickets?due=today", counts.heute > 0 ? "text-amber-500" : undefined)}
        {tile("Überfällig", counts.ueberfaellig, AlertTriangle, "/tickets?due=overdue", counts.ueberfaellig > 0 ? "text-destructive" : undefined)}
        {tile("Termine heute", counts.termine_heute, CalendarDays, "/esc/buchungen")}
        {tile("Warten auf Kunde", counts.warten_kunde, PauseCircle, "/tickets?status=Warten%20auf%20Kunde")}
        {tile("Eskaliert", counts.eskaliert, Flame, "/tickets?status=Eskaliert", counts.eskaliert > 0 ? "text-destructive" : undefined)}
      </div>
    </div>
  );
}
