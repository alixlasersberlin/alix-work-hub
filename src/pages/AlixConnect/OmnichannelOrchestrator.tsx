import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Radio, Loader2, MessageSquare, Mail, Phone, Smartphone } from "lucide-react";

type Contact = { id: string; name: string | null; email: string | null; phone: string | null };

const channelIcon = (c: string) => {
  const cls = "h-4 w-4";
  if (c === "email") return <Mail className={cls} />;
  if (c === "sms") return <Smartphone className={cls} />;
  if (c === "voice") return <Phone className={cls} />;
  return <MessageSquare className={cls} />;
};

export default function OmnichannelOrchestrator() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [goal, setGoal] = useState("Follow-up nach Angebot");
  const [active, setActive] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const query = supabase.from("ac_contacts").select("id, full_name, email, phone").order("updated_at", { ascending: false }).limit(50);
      const { data } = q ? await query.ilike("full_name", `%${q}%`) : await query;
      setContacts(((data ?? []) as any[]).map((c) => ({ id: c.id, name: c.full_name, email: c.email, phone: c.phone })));
    })();
  }, [q]);

  const orchestrate = async (c: Contact) => {
    setActive(c); setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ac-omnichannel-orchestrate", { body: { contact_id: c.id, goal } });
      if (error) throw error;
      setResult(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Omnichannel Orchestrator</h1>
        <Badge variant="outline">Phase 34</Badge>
      </div>
      <p className="text-sm text-muted-foreground">KI wählt automatisch den besten Kanal (WhatsApp/Email/Call/SMS) je Kontakt & Kontext und plant Multi-Touch-Sequenzen.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Kontakte</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Ziel / Kontext…" value={goal} onChange={(e) => setGoal(e.target.value)} />
            <Input placeholder="Suche…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-[60vh] overflow-y-auto -mx-6">
              {contacts.map((c) => (
                <button key={c.id} onClick={() => orchestrate(c)}
                  className={`w-full text-left px-6 py-2 border-b border-border/50 hover:bg-muted/50 ${active?.id === c.id ? "bg-muted" : ""}`}>
                  <div className="text-sm font-medium truncate">{c.name || c.email || "(unbenannt)"}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.email || c.phone}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Empfohlene Sequenz {active ? `— ${active.name || active.email}` : ""}</CardTitle></CardHeader>
          <CardContent>
            {!active && <div className="text-sm text-muted-foreground">Kontakt links wählen…</div>}
            {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> KI plant…</div>}
            {result && !loading && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded border p-3 bg-primary/5">
                  <div className="flex items-center gap-2">
                    {channelIcon(result.primary_channel)}
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">Primary Channel</div>
                      <div className="text-lg font-semibold capitalize">{result.primary_channel}</div>
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xs uppercase text-muted-foreground">Confidence</div>
                    <div className="text-lg font-semibold">{Math.round((result.confidence ?? 0) * 100)}%</div>
                  </div>
                </div>
                {Array.isArray(result.sequence) && (
                  <ol className="space-y-2">
                    {result.sequence.map((s: any, i: number) => (
                      <li key={i} className="rounded border p-3 flex items-start gap-3">
                        <div className="text-xs font-mono w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">{i + 1}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium capitalize">
                            {channelIcon(s.channel)} {s.channel}
                            <span className="text-xs text-muted-foreground">+{s.delay_hours}h</span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">{s.message_hint}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {result.reasoning && <div className="text-xs text-muted-foreground italic">{result.reasoning}</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
