import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, RefreshCw, Link2 } from "lucide-react";

export default function EmailSync() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("mail_messages" as any)
      .select("id,subject,from_address,to_address,received_at,ac_contact_id,linked_order_id,linked_ticket_id")
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function autoLink() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("ac-email-autolink", { body: {} });
    setSyncing(false);
    if (error) return toast.error(error.message);
    toast.success(`${data?.linked ?? 0} Mails verknüpft`);
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h2 className="text-2xl font-semibold">Email-Kanal</h2>
          <p className="text-sm text-muted-foreground">IMAP-Sync in Unified Inbox, automatische Thread-Zuordnung zu Kontakt/Auftrag/Ticket.</p>
        </div>
        <Button onClick={autoLink} disabled={syncing}><Link2 className="h-4 w-4 mr-2" />{syncing ? "…" : "Auto-Verknüpfen"}</Button>
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Letzte Emails ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Lade…</p> : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Mails. Postfach in Einstellungen konfigurieren.</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((m) => (
                <div key={m.id} className="rounded-md border border-border/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{m.subject ?? "(kein Betreff)"}</div>
                      <div className="text-xs text-muted-foreground truncate">Von {m.from_address ?? "—"} · An {m.to_address ?? "—"}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] text-muted-foreground">{m.received_at ? new Date(m.received_at).toLocaleString("de-DE") : ""}</span>
                      <div className="flex gap-1">
                        {m.ac_contact_id && <Badge variant="secondary" className="text-[10px]">Kontakt ✓</Badge>}
                        {m.linked_order_id && <Badge variant="secondary" className="text-[10px]">Auftrag ✓</Badge>}
                        {m.linked_ticket_id && <Badge variant="secondary" className="text-[10px]">Ticket ✓</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
