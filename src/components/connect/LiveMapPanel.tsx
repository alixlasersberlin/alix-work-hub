import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio } from "lucide-react";

const FLAG: Record<string, string> = {
  DE: "🇩🇪", AT: "🇦🇹", CH: "🇨🇭", US: "🇺🇸", GB: "🇬🇧", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸",
  NL: "🇳🇱", BE: "🇧🇪", PL: "🇵🇱", CZ: "🇨🇿", TR: "🇹🇷", RU: "🇷🇺", UA: "🇺🇦", CN: "🇨🇳",
  JP: "🇯🇵", KR: "🇰🇷", IN: "🇮🇳", BR: "🇧🇷", CA: "🇨🇦", AU: "🇦🇺", XX: "🌐",
};

type Row = { country: string; visitors: number; last_seen: string };

export default function LiveMapPanel({ websiteId }: { websiteId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const total = rows.reduce((s, r) => s + r.visitors, 0);

  async function load() {
    const { data } = await supabase.rpc("ac_web_live_map", { _website_id: websiteId });
    setRows((data as any) ?? []);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [websiteId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Radio className="h-4 w-4 text-primary animate-pulse" /> Live-Besucher weltweit</CardTitle>
        <span className="text-xs text-muted-foreground">{total} online · letzte 5 Min</span>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Keine aktiven Besucher.</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {rows.map((r) => {
            const pct = total > 0 ? (r.visitors / total) * 100 : 0;
            return (
              <div key={r.country} className="relative rounded-md border border-border/60 p-2 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-primary/20" style={{ width: `${pct}%` }} />
                <div className="relative flex items-center gap-2">
                  <span className="text-xl">{FLAG[r.country] || "🌐"}</span>
                  <div>
                    <div className="text-xs font-mono">{r.country}</div>
                    <div className="text-sm font-semibold">{r.visitors}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
