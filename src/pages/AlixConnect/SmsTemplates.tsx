import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Plus, MessageSquare } from "lucide-react";

type Template = { id: string; name: string; body: string; created_at: string };

export default function SmsTemplates() {
  const [items, setItems] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ac_templates" as any)
      .select("id,name,body,created_at")
      .eq("channel", "sms")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name || !body) return toast.error("Name und Text erforderlich");
    const { error } = await supabase.from("ac_templates" as any).insert({ name, body, channel: "sms" });
    if (error) return toast.error(error.message);
    setName(""); setBody(""); toast.success("Template gespeichert"); load();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("ac_templates" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht"); load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-semibold">SMS-Templates</h2>
          <p className="text-sm text-muted-foreground">Vorlagen für 2-Weg-SMS & Kampagnen. Platzhalter: {"{{name}}"}, {"{{order}}"}.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Neues Template</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Name (z.B. Terminerinnerung)" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea rows={4} placeholder="Hallo {{name}}, Ihr Termin für Auftrag {{order}}..." value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{body.length}/1600 Zeichen · {Math.ceil(body.length / 160)} SMS-Segmente</span>
            <Button onClick={add}><Plus className="h-4 w-4 mr-2" />Speichern</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vorlagen ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Lade…</p> : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Templates.</p>
          ) : (
            <div className="space-y-2">
              {items.map((t) => (
                <div key={t.id} className="flex items-start justify-between rounded-md border border-border/50 p-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.body}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
