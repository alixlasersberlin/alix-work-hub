import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Search, Mail, MessageSquare, PhoneCall, Ticket, TrendingDown, TrendingUp } from "lucide-react";

type Contact = { id: string; display_name: string | null; phone: string | null; email: string | null; lifetime_value: number | null; last_interaction_at: string | null };
type Score = { churn_score: number; engagement_score: number; segment: string | null; next_best_action: string | null; reasoning: string | null; computed_at: string };
type TimelineItem = { at: string; type: "message" | "call" | "email" | "ticket"; title: string; detail?: string };

export default function Customer360() {
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [computing, setComputing] = useState(false);

  async function search() {
    const query = q.trim();
    let req = supabase.from("ac_contacts").select("id,display_name,phone,email,lifetime_value,last_interaction_at").order("last_interaction_at", { ascending: false, nullsFirst: false }).limit(50);
    if (query) req = req.or(`display_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
    const { data, error } = await req;
    if (error) return toast.error(error.message);
    setContacts((data as any) ?? []);
  }
  useEffect(() => { search(); }, []);

  async function open(c: Contact) {
    setSelected(c); setScore(null); setTimeline([]);
    const [msgs, calls, mails, tickets, sc] = await Promise.all([
      supabase.from("ac_messages").select("id,body,channel_id,created_at,direction").eq("sender_contact_id", c.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("ac_calls" as any).select("id,direction,duration_seconds,started_at,status").eq("contact_id", c.id).order("started_at", { ascending: false }).limit(50),
      supabase.from("mail_messages" as any).select("id,subject,received_at,from_address").eq("ac_contact_id", c.id).order("received_at", { ascending: false }).limit(50),
      supabase.from("tickets" as any).select("id,subject,created_at,status").eq("customer_email", c.email ?? "___").order("created_at", { ascending: false }).limit(20),
      supabase.from("ac_customer_scores" as any).select("*").eq("contact_id", c.id).maybeSingle(),
    ]);
    const items: TimelineItem[] = [];
    (msgs.data ?? []).forEach((m: any) => items.push({ at: m.created_at, type: "message", title: `${m.channel?.toUpperCase()} · ${m.direction}`, detail: m.body }));
    (calls.data ?? []).forEach((c: any) => items.push({ at: c.started_at, type: "call", title: `Anruf ${c.direction} · ${c.status}`, detail: `${c.duration_seconds ?? 0}s` }));
    (mails.data ?? []).forEach((m: any) => items.push({ at: m.received_at, type: "email", title: `Email · ${m.from_address ?? ""}`, detail: m.subject }));
    (tickets.data ?? []).forEach((t: any) => items.push({ at: t.created_at, type: "ticket", title: `Ticket · ${t.status}`, detail: t.subject }));
    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setTimeline(items);
    setScore((sc.data as any) ?? null);
  }

  async function computeScore() {
    if (!selected) return;
    setComputing(true);
    const { data, error } = await supabase.functions.invoke("ac-customer-score", { body: { contact_id: selected.id } });
    setComputing(false);
    if (error) return toast.error(error.message);
    toast.success("Score berechnet");
    setScore(data?.score ?? null);
  }

  const iconFor = (t: TimelineItem["type"]) =>
    t === "message" ? <MessageSquare className="h-4 w-4 text-blue-500" /> :
    t === "call" ? <PhoneCall className="h-4 w-4 text-green-500" /> :
    t === "email" ? <Mail className="h-4 w-4 text-purple-500" /> :
    <Ticket className="h-4 w-4 text-amber-500" />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-semibold">Customer Intelligence 360°</h2>
          <p className="text-sm text-muted-foreground">Alle Kanäle pro Kontakt, Segmentierung, Churn-Score, Next Best Action (Gemini).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Kontakte</CardTitle>
            <div className="flex gap-2 pt-2">
              <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} /></div>
              <Button onClick={search}>OK</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[600px] overflow-auto">
            {contacts.map((c) => (
              <button key={c.id} onClick={() => open(c)} className={`w-full text-left rounded-md border p-2.5 text-sm ${selected?.id === c.id ? "border-primary bg-primary/10" : "border-border/50 hover:bg-muted/40"}`}>
                <div className="font-medium">{c.display_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{c.phone ?? c.email ?? "—"}</div>
              </button>
            ))}
            {contacts.length === 0 && <p className="text-sm text-muted-foreground">Keine Treffer.</p>}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Kontakt auswählen für 360°-Ansicht.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle>{selected.display_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{selected.phone ?? "—"} · {selected.email ?? "—"}</p>
                  </div>
                  <Button size="sm" onClick={computeScore} disabled={computing}><Sparkles className="h-4 w-4 mr-2" />{computing ? "Rechne…" : "Score berechnen"}</Button>
                </CardHeader>
                <CardContent>
                  {score ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-md border border-border/50 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Churn</div>
                        <div className="text-2xl font-semibold mt-1">{Math.round(score.churn_score)}<span className="text-xs text-muted-foreground">/100</span></div>
                      </div>
                      <div className="rounded-md border border-border/50 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Engagement</div>
                        <div className="text-2xl font-semibold mt-1">{Math.round(score.engagement_score)}<span className="text-xs text-muted-foreground">/100</span></div>
                      </div>
                      <div className="rounded-md border border-border/50 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Segment</div>
                        <div className="text-lg font-medium mt-1">{score.segment ?? "—"}</div>
                      </div>
                      <div className="rounded-md border border-border/50 p-3 md:col-span-1 col-span-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Best Action</div>
                        <div className="text-sm mt-1">{score.next_best_action ?? "—"}</div>
                      </div>
                      {score.reasoning && <div className="md:col-span-4 col-span-2 text-xs text-muted-foreground italic">{score.reasoning}</div>}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Noch kein Score – „Score berechnen" klicken.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Timeline ({timeline.length})</CardTitle></CardHeader>
                <CardContent className="max-h-[500px] overflow-auto">
                  {timeline.length === 0 ? <p className="text-sm text-muted-foreground">Keine Aktivität.</p> :
                    <div className="space-y-2">
                      {timeline.map((t, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-md border border-border/40 p-2.5">
                          <div className="mt-0.5">{iconFor(t.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{t.title}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(t.at).toLocaleString("de-DE")}</span>
                            </div>
                            {t.detail && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.detail}</div>}
                          </div>
                        </div>
                      ))}
                    </div>}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
