import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AlixConnectPortal() {
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [threads, setThreads] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      let query = supabase.from("ac_contacts").select("*").order("last_seen_at", { ascending: false, nullsFirst: false }).limit(50);
      if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,phone.ilike.%${q}%`);
      const { data } = await query;
      setContacts(data ?? []);
    })();
  }, [q]);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const { data } = await supabase
        .from("ac_conversations")
        .select("*")
        .eq("contact_id", selected.id)
        .order("created_at", { ascending: false });
      setThreads(data ?? []);
    })();
  }, [selected]);

  return (
    <div className="h-full grid grid-cols-[320px_1fr]">
      <div className="border-r border-border/60 overflow-auto p-3 space-y-2">
        <Input placeholder="Kunde suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        {contacts.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className={`w-full text-left rounded-md border p-2 hover:bg-muted/50 ${
              selected?.id === c.id ? "bg-muted border-primary/40" : "border-border/60"
            }`}
          >
            <div className="text-sm font-medium">{c.name || c.email || c.phone || "Anonym"}</div>
            <div className="text-[11px] text-muted-foreground truncate">{c.email || c.phone || c.id}</div>
          </button>
        ))}
        {contacts.length === 0 && <p className="text-xs text-muted-foreground p-2">Keine Kontakte gefunden.</p>}
      </div>
      <div className="overflow-auto p-6">
        {!selected ? (
          <div className="text-sm text-muted-foreground">Kunde links auswählen, um die 360°-Sicht anzuzeigen.</div>
        ) : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selected.name || "Anonymer Kontakt"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.email || "—"} · {selected.phone || "—"}
                  </p>
                </div>
                {selected.customer_id && <Badge variant="outline">CRM verknüpft</Badge>}
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Konversationen ({threads.length})</h3>
              <div className="space-y-2">
                {threads.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded border border-border/60 p-2 text-sm">
                    <div className="truncate">{t.subject || t.channel_type}</div>
                    <Badge variant="secondary">{t.status}</Badge>
                  </div>
                ))}
                {threads.length === 0 && <div className="text-xs text-muted-foreground">Keine Konversationen.</div>}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
