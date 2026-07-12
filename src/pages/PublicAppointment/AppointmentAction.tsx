import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, CalendarClock, Loader2 } from "lucide-react";

type Action = "confirm" | "reschedule" | "cancel";

export default function AppointmentAction({ action }: { action: Action }) {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newStart, setNewStart] = useState<string>(params.get("start") ?? "");

  const run = async (a: Action, extra?: Record<string, unknown>) => {
    setBusy(true); setError(null);
    const { data, error } = await supabase.functions.invoke("public-appointment-action", {
      body: { token, action: a, ...(extra ?? {}) },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      setError((data as any)?.error ?? error?.message ?? "Fehler");
      return;
    }
    setDone(a);
  };

  useEffect(() => {
    if (action === "confirm" || action === "cancel") {
      run(action);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const title = action === "confirm" ? "Termin bestätigen"
    : action === "reschedule" ? "Termin verschieben"
    : "Termin absagen";
  const Icon = action === "confirm" ? CheckCircle2 : action === "cancel" ? XCircle : CalendarClock;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Icon className="w-6 h-6" /> {title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {busy && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Wird verarbeitet…</div>}
          {error && <p className="text-destructive text-sm">{error}</p>}
          {done && (
            <p className="text-sm">
              {done === "confirm" && "Vielen Dank — Ihr Termin ist bestätigt."}
              {done === "cancel" && "Ihr Termin wurde abgesagt. Wir melden uns bei Ihnen."}
              {done === "reschedule" && "Danke — wir prüfen den neuen Wunschtermin und bestätigen ihn kurzfristig."}
            </p>
          )}
          {action === "reschedule" && !done && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Bitte wählen Sie einen neuen Wunschtermin:</p>
              <Input type="datetime-local" value={newStart} onChange={e => setNewStart(e.target.value)} />
              <Button onClick={() => newStart && run("reschedule", { new_start: new Date(newStart).toISOString() })}
                      disabled={busy || !newStart} className="w-full">
                Neuen Termin senden
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
