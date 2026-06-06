import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, Clock, AlertOctagon, FileWarning } from "lucide-react";
import { toast } from "sonner";

type Warranty = {
  id: string; serial_number: string; device_name: string | null; customer_name: string | null;
  warranty_start: string | null; warranty_end: string | null; warranty_type: string | null; warranty_status: string;
};
type Claim = {
  id: string; serial_number: string; claim_date: string; claim_reason: string | null; approval_status: string; notes: string | null;
};

export default function Garantiecenter() {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [w, c] = await Promise.all([
      supabase.from("warranty_records").select("id, serial_number, device_name, customer_name, warranty_start, warranty_end, warranty_type, warranty_status").order("warranty_end", { ascending: true }).limit(2000),
      supabase.from("warranty_claims").select("id, serial_number, claim_date, claim_reason, approval_status, notes").order("claim_date", { ascending: false }).limit(1000),
    ]);
    if (w.error) toast.error(w.error.message);
    if (c.error) toast.error(c.error.message);
    setWarranties((w.data as Warranty[]) ?? []);
    setClaims((c.data as Claim[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const kpis = useMemo(() => ({
    active: warranties.filter((w) => w.warranty_status === "Aktiv").length,
    soon: warranties.filter((w) => w.warranty_end && w.warranty_end >= today && w.warranty_end <= in90).length,
    expired: warranties.filter((w) => w.warranty_status === "Abgelaufen").length,
    openClaims: claims.filter((c) => c.approval_status === "Offen").length,
  }), [warranties, claims, today, in90]);

  const filteredW = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return warranties;
    return warranties.filter((w) => [w.serial_number, w.device_name, w.customer_name].some((v) => (v ?? "").toLowerCase().includes(s)));
  }, [warranties, q]);

  const statusBadge = (s: string) => {
    const v: Record<string, string> = {
      "Aktiv": "bg-green-500/15 text-green-500 border-green-500/30",
      "Läuft bald ab": "bg-amber-500/15 text-amber-500 border-amber-500/30",
      "Abgelaufen": "bg-red-500/15 text-red-500 border-red-500/30",
    };
    return <Badge variant="outline" className={v[s] ?? ""}>{s}</Badge>;
  };

  const claimBadge = (s: string) => {
    const v: Record<string, string> = {
      "Offen": "bg-amber-500/15 text-amber-500 border-amber-500/30",
      "Genehmigt": "bg-green-500/15 text-green-500 border-green-500/30",
      "Abgelehnt": "bg-red-500/15 text-red-500 border-red-500/30",
    };
    return <Badge variant="outline" className={v[s] ?? ""}>{s}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-primary" /> Garantiecenter</h1>
        <p className="text-muted-foreground mt-1">Übersicht aller Garantien und Garantiefälle.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi icon={<ShieldCheck className="h-5 w-5 text-green-500" />} title="Aktive Garantien" value={kpis.active} />
        <Kpi icon={<Clock className="h-5 w-5 text-amber-500" />} title="Läuft in 90 Tagen ab" value={kpis.soon} />
        <Kpi icon={<AlertOctagon className="h-5 w-5 text-red-500" />} title="Abgelaufen" value={kpis.expired} />
        <Kpi icon={<FileWarning className="h-5 w-5 text-primary" />} title="Offene Garantiefälle" value={kpis.openClaims} />
      </div>

      <Tabs defaultValue="warranties">
        <TabsList>
          <TabsTrigger value="warranties">Garantien</TabsTrigger>
          <TabsTrigger value="claims">Garantiefälle</TabsTrigger>
        </TabsList>

        <TabsContent value="warranties" className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Suche Seriennummer / Gerät / Kunde…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
            <Button variant="outline" onClick={load}>Aktualisieren</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seriennummer</TableHead>
                    <TableHead>Gerät</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Beginn</TableHead>
                    <TableHead>Ende</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Lade…</TableCell></TableRow>}
                  {!loading && filteredW.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Garantien gefunden.</TableCell></TableRow>}
                  {filteredW.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs">{w.serial_number}</TableCell>
                      <TableCell>{w.device_name ?? "—"}</TableCell>
                      <TableCell>{w.customer_name ?? "—"}</TableCell>
                      <TableCell>{w.warranty_start ?? "—"}</TableCell>
                      <TableCell>{w.warranty_end ?? "—"}</TableCell>
                      <TableCell>{w.warranty_type ?? "—"}</TableCell>
                      <TableCell>{statusBadge(w.warranty_status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims">
          <Card>
            <CardHeader><CardTitle>Garantiefälle</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Seriennummer</TableHead>
                    <TableHead>Grund</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notizen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Keine Garantiefälle.</TableCell></TableRow>}
                  {claims.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.claim_date}</TableCell>
                      <TableCell className="font-mono text-xs">{c.serial_number}</TableCell>
                      <TableCell>{c.claim_reason ?? "—"}</TableCell>
                      <TableCell>{claimBadge(c.approval_status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon, title, value }: { icon: React.ReactNode; title: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
