import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Contact = { id: string; full_name: string | null; email: string | null; phone: string | null; country: string | null; customer_id: string | null; last_seen_at: string };

export default function ContactsPage() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      let query = supabase.from("ac_contacts").select("id, full_name, email, phone, country, customer_id, last_seen_at").order("last_seen_at", { ascending: false }).limit(200);
      if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
      const { data } = await query;
      setRows((data as any) || []);
    })();
  }, [q]);

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kontakte</h2>
        <Input placeholder="Suche…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Externe Absender ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Land</TableHead>
                <TableHead>Verknüpfung</TableHead>
                <TableHead>Letzter Kontakt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.full_name || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{c.email || "—"}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>{c.country || "—"}</TableCell>
                  <TableCell>{c.customer_id ? <Badge>Kunde</Badge> : <Badge variant="outline">Neuer Kontakt</Badge>}</TableCell>
                  <TableCell className="text-xs">{new Date(c.last_seen_at).toLocaleString("de-DE")}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Noch keine Kontakte.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
