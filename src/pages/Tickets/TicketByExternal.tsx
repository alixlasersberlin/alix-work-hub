import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

export default function TicketByExternal() {
  const { externalId } = useParams<{ externalId: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!externalId) {
        setError("Keine external_ticket_id übergeben.");
        return;
      }
      // 1. by external_ticket_id, 2. by ticket_number as fallback
      const { data, error: qErr } = await supabase
        .from("tickets")
        .select("id")
        .or(`external_ticket_id.eq.${externalId},ticket_number.eq.${externalId}`)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (qErr || !data?.id) {
        setError("Dieses Ticket konnte in AlixWork nicht gefunden werden.");
        // best-effort: log lookup failure (non-blocking)
        try {
          await supabase.from("ticket_outbound_sync_logs").insert({
            ticket_id: null as any,
            external_ticket_id: externalId,
            action: "deep_link_lookup",
            status: "error",
            error_message: qErr?.message || "ticket not found",
            direction: "outbound",
          } as any);
        } catch { /* ignore */ }
        return;
      }
      navigate(`/tickets/${data.id}`, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [externalId, navigate]);

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-xl">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Ticket nicht gefunden</h1>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">
            Externe ID: <code className="font-mono">{externalId}</code>
          </p>
          <Button asChild variant="outline">
            <Link to="/tickets">Zur Ticket-Übersicht</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 flex items-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      Ticket wird in AlixWork geöffnet…
    </div>
  );
}
