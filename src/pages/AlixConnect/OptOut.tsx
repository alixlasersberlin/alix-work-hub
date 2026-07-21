import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Ban, Search } from "lucide-react";

type Contact = { id: string; display_name: string | null; phone: string | null; email: string | null; sms_opt_out: boolean; email_opt_out: boolean; sms_opt_out_at: string | null; email_opt_out_at: string | null };

export default function OptOut() {
  const [items, setItems] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("ac_contacts")
      .select("id,display_name,phone,email,sms_opt_out,email_opt_out,sms_opt_out_at,email_opt_out_at")
      .or("sms_opt_out.eq.true,email_opt_out.eq.true")
      .order("sms_opt_out_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (q) query = query.or(`display_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setItems((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(id: string, field: "sms_opt_out" | "email_opt_out", val: boolean) {
    const patch: any = { [field]: val, [`${field}_at`]: val ? new Date().toISOString() : null };
    const { error } = await supabase.from("ac_contacts").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(val ? "Opt-out gesetzt" : "Opt-out entfernt");
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Ban className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-semibold">Opt-out Management</h2>
          <p className="text-sm text-muted-foreground">DSGVO-konforme Sperrlisten für SMS & Email. Reply „STOP" wird automatisch verarbeitet.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Name, Telefon oder Email suchen…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <Button onClick={load}>Suchen</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Gesperrte Kontakte ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Lade…</p> : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Opt-outs vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {items.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 p-3">
                  <div>
                    <div className="font-medium text-sm">{c.display_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.phone ?? "—"} · {c.email ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.sms_opt_out && <Badge variant="destructive">SMS gesperrt</Badge>}
                    {c.email_opt_out && <Badge variant="destructive">Email gesperrt</Badge>}
                    <Button size="sm" variant="outline" onClick={() => toggle(c.id, "sms_opt_out", !c.sms_opt_out)}>SMS {c.sms_opt_out ? "freigeben" : "sperren"}</Button>
                    <Button size="sm" variant="outline" onClick={() => toggle(c.id, "email_opt_out", !c.email_opt_out)}>Email {c.email_opt_out ? "freigeben" : "sperren"}</Button>
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
