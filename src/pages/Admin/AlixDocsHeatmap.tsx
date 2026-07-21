import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Flame, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Ev = { id: string; share_link_id: string; document_id: string | null; event_type: string; page_no: number | null; dwell_ms: number | null; ip_hash: string | null; country: string | null; user_agent: string | null; created_at: string };
type Link = { id: string; token: string; note: string | null; document_ids: string[]; expires_at: string | null; download_count: number; created_at: string };

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function AlixDocsHeatmap() {
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [linkId, setLinkId] = useState<string>("");
  const [events, setEvents] = useState<Ev[]>([]);
  const [days, setDays] = useState(30);

  const loadLinks = async () => {
    const { data, error } = await supabase.from("alixdocs_share_links")
      .select("id, token, note, document_ids, expires_at, download_count, created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) { toast.error(error.message); return; }
    setLinks((data ?? []) as any);
    if ((data ?? []).length && !linkId) setLinkId((data as any)[0].id);
  };

  const loadEvents = async () => {
    setBusy(true);
    try {
      const from = new Date(Date.now() - days * 86400_000).toISOString();
      let q = supabase.from("alixdocs_share_events").select("*").gte("created_at", from).order("created_at", { ascending: false }).limit(5000);
      if (linkId) q = q.eq("share_link_id", linkId);
      const { data, error } = await q;
      if (error) throw error;
      setEvents((data ?? []) as any);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setBusy(false); }
  };

  useEffect(() => { loadLinks(); }, []);
  useEffect(() => { if (linkId) loadEvents(); }, [linkId, days]);

  const totals = useMemo(() => {
    const t = { view: 0, unlock: 0, open: 0, download: 0, zip: 0, page_view: 0, unique_ips: new Set<string>() };
    for (const e of events) {
      (t as any)[e.event_type] = ((t as any)[e.event_type] ?? 0) + 1;
      if (e.ip_hash) t.unique_ips.add(e.ip_hash);
    }
    return { ...t, unique: t.unique_ips.size };
  }, [events]);

  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const e of events) {
      const d = new Date(e.created_at);
      const dow = (d.getDay() + 6) % 7; // Mo=0
      const h = d.getHours();
      grid[dow][h] += 1;
      if (grid[dow][h] > max) max = grid[dow][h];
    }
    return { grid, max };
  }, [events]);

  const perDoc = useMemo(() => {
    const m = new Map<string, { open: number; download: number; dwell: number; page_view: number }>();
    for (const e of events) {
      if (!e.document_id) continue;
      const r = m.get(e.document_id) ?? { open: 0, download: 0, dwell: 0, page_view: 0 };
      if (e.event_type === "open") r.open++;
      else if (e.event_type === "download") r.download++;
      else if (e.event_type === "page_view") r.page_view++;
      else if (e.event_type === "dwell" && e.dwell_ms) r.dwell += e.dwell_ms;
      m.set(e.document_id, r);
    }
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.open + b.download) - (a.open + a.download));
  }, [events]);

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">AlixDocs — Share Heatmap</h1>
        <Badge variant="outline">Phase 12</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filter</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <div className="min-w-[280px] flex-1">
            <label className="text-xs text-muted-foreground">Share-Link</label>
            <select value={linkId} onChange={e => setLinkId(e.target.value)} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">— alle —</option>
              {links.map(l => (
                <option key={l.id} value={l.id}>
                  {l.token.slice(0, 8)}… · {l.document_ids?.length ?? 0} Docs · {l.note?.slice(0, 40) || "kein Text"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tage</label>
            <Input type="number" value={days} onChange={e => setDays(Math.max(1, Number(e.target.value)))} className="w-24" />
          </div>
          <Button onClick={loadEvents} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</>}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { l: "Aufrufe", v: totals.view },
          { l: "Entsperrt", v: totals.unlock },
          { l: "Öffnungen", v: totals.open },
          { l: "Downloads", v: totals.download + totals.zip },
          { l: "Seitenaufrufe", v: totals.page_view },
          { l: "Unique Besucher", v: totals.unique },
        ].map(k => (
          <Card key={k.l}><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{k.l}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{k.v}</CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Aktivitäts-Heatmap (Wochentag × Stunde, lokale Zeit)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-xs">
            <thead><tr><th className="w-8"></th>{HOURS.map(h => <th key={h} className="w-6 text-center font-normal text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {DAYS.map((d, dow) => (
                <tr key={d}>
                  <td className="pr-2 text-muted-foreground">{d}</td>
                  {HOURS.map(h => {
                    const v = heatmap.grid[dow][h];
                    const a = heatmap.max ? v / heatmap.max : 0;
                    return <td key={h} className="w-6 h-6 border border-border/30" style={{ backgroundColor: v ? `hsl(var(--primary) / ${0.15 + a * 0.75})` : "transparent" }} title={`${d} ${h}:00 · ${v}`}></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pro Dokument</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Dokument-ID</TableHead><TableHead className="text-right">Öffnungen</TableHead><TableHead className="text-right">Seiten</TableHead><TableHead className="text-right">Downloads</TableHead><TableHead className="text-right">Verweildauer</TableHead></TableRow></TableHeader>
            <TableBody>
              {perDoc.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-right">{r.open}</TableCell>
                  <TableCell className="text-right">{r.page_view}</TableCell>
                  <TableCell className="text-right">{r.download}</TableCell>
                  <TableCell className="text-right">{Math.round(r.dwell / 1000)}s</TableCell>
                </TableRow>
              ))}
              {!perDoc.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Keine Ereignisse im Zeitraum</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
