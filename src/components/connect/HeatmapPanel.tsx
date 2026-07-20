import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame } from "lucide-react";

type Point = { x_pct: number; y_pct: number; hits: number };
type PageRow = { page_url: string; clicks: number };

export default function HeatmapPanel({ websiteId, from, to }: { websiteId: string; from: Date; to: Date }) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [page, setPage] = useState<string>("");
  const [points, setPoints] = useState<Point[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("ac_web_click_pages", { _website_id: websiteId, _from: from.toISOString(), _to: to.toISOString() });
      const rows = (data as PageRow[]) ?? [];
      setPages(rows);
      if (!page && rows[0]) setPage(rows[0].page_url);
    })();
  }, [websiteId, from.getTime(), to.getTime()]);

  useEffect(() => {
    if (!websiteId) return;
    (async () => {
      const { data } = await supabase.rpc("ac_web_click_heatmap", {
        _website_id: websiteId,
        _page: page || null,
        _from: from.toISOString(),
        _to: to.toISOString(),
      });
      setPoints((data as Point[]) ?? []);
    })();
  }, [websiteId, page, from.getTime(), to.getTime()]);

  const maxHits = useMemo(() => Math.max(1, ...points.map((p) => p.hits)), [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // simple radial gradient heatmap
    points.forEach((p) => {
      const x = (p.x_pct / 100) * canvas.width;
      const y = (p.y_pct / 100) * canvas.height;
      const intensity = Math.min(1, p.hits / maxHits);
      const radius = 22 + intensity * 30;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(239, 68, 68, ${0.15 + 0.55 * intensity})`);
      grad.addColorStop(0.5, `rgba(249, 115, 22, ${0.15 + 0.35 * intensity})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    });
  }, [points, maxHits]);

  const totalClicks = points.reduce((s, p) => s + p.hits, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4" /> Click Heatmap</CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{totalClicks} Klicks · {points.length} Zonen</span>
          <Select value={page} onValueChange={setPage}>
            <SelectTrigger className="h-8 w-[360px]"><SelectValue placeholder="Seite wählen" /></SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.page_url} value={p.page_url} className="text-xs">
                  {shortenUrl(p.page_url)} · {p.clicks}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative w-full rounded-md border border-border/60 bg-muted/40 overflow-hidden" style={{ aspectRatio: "16/10" }}>
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-20 pointer-events-none">
            {Array.from({ length: 24 }).map((_, i) => <div key={i} className="border border-border/60" />)}
          </div>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          {points.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Noch keine Klick-Daten. Der Tracker erfasst Klicks automatisch (ab Phase 14).
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Koordinaten sind relativ zum Viewport des Besuchers. Zonen werden zu 2%-Rastern gruppiert.
        </p>
      </CardContent>
    </Card>
  );
}

function shortenUrl(u?: string | null): string {
  if (!u) return "";
  try { const url = new URL(u); return url.pathname + (url.search || ""); } catch { return u; }
}
