import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users2, Eye } from "lucide-react";

type Session = {
  session_hash: string; visitor_hash: string;
  started_at: string; last_seen: string;
  pageviews: number; events: number;
  country: string | null; device_type: string | null; browser: string | null;
  entry_url: string | null; referrer: string | null;
};
type Event = { created_at: string; event_type: string; page_url: string | null; page_title: string | null; scroll_depth: number | null; duration_ms: number | null; metadata: any };

export default function SessionsPanel({ websiteId, from, to }: { websiteId: string; from: Date; to: Date }) {
  const [rows, setRows] = useState<Session[]>([]);
  const [openHash, setOpenHash] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("ac_web_sessions", { _website_id: websiteId, _from: from.toISOString(), _to: to.toISOString(), _limit: 50 });
      setRows((data as any) ?? []);
    })();
  }, [websiteId, from.getTime(), to.getTime()]);

  useEffect(() => {
    if (!openHash) return;
    (async () => {
      const { data } = await supabase.rpc("ac_web_session_events", { _session_hash: openHash });
      setEvents((data as any) ?? []);
    })();
  }, [openHash]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users2 className="h-4 w-4" /> Sitzungen (letzte 50)</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Zeit</TableHead><TableHead>Land</TableHead><TableHead>Gerät</TableHead>
            <TableHead className="text-right">Views</TableHead><TableHead className="text-right">Events</TableHead>
            <TableHead>Einstieg</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.session_hash}>
                <TableCell className="text-xs">{new Date(r.last_seen).toLocaleString("de-DE")}</TableCell>
                <TableCell className="text-xs">{r.country || "–"}</TableCell>
                <TableCell className="text-xs">{r.device_type || "–"} · {r.browser || ""}</TableCell>
                <TableCell className="text-right text-xs">{r.pageviews}</TableCell>
                <TableCell className="text-right text-xs">{r.events}</TableCell>
                <TableCell className="font-mono text-xs truncate max-w-[280px]" title={r.entry_url || ""}>{shorten(r.entry_url)}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => setOpenHash(r.session_hash)}><Eye className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">Keine Sitzungen im Zeitraum.</TableCell></TableRow>}
          </TableBody>
        </Table>

        <Dialog open={!!openHash} onOpenChange={(v) => !v && setOpenHash(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Session-Journey</DialogTitle></DialogHeader>
            <div className="space-y-1">
              {events.map((e, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border/50 py-1.5">
                  <span className="text-[10px] text-muted-foreground w-20">{new Date(e.created_at).toLocaleTimeString("de-DE")}</span>
                  <Badge variant="outline" className="text-[10px]">{e.event_type}</Badge>
                  <span className="font-mono text-xs truncate flex-1" title={e.page_url || ""}>{shorten(e.page_url)}</span>
                  {e.scroll_depth != null && <span className="text-[10px] text-muted-foreground">↓ {e.scroll_depth}%</span>}
                  {e.duration_ms != null && <span className="text-[10px] text-muted-foreground">{Math.round(e.duration_ms / 1000)}s</span>}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function shorten(u?: string | null) { if (!u) return ""; try { const x = new URL(u); return x.pathname + (x.search || ""); } catch { return u; } }
