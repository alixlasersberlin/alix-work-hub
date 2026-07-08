import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ChartDef } from "@/lib/abic/types";

const PALETTE = ["#fbbf24", "#f59e0b", "#eab308", "#a78bfa", "#34d399", "#60a5fa", "#f472b6"];

export function ChartCard({ chart }: { chart: ChartDef }) {
  const data = chart.data as Array<Record<string, number | string>>;

  const body = (() => {
    switch (chart.type) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="v" stroke={PALETTE[0]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`grad-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE[0]} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={PALETTE[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="v" stroke={PALETTE[0]} strokeWidth={2} fill={`url(#grad-${chart.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => (<Cell key={i} fill={PALETTE[i % PALETTE.length]} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Pie data={data} dataKey="v" nameKey="t" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {data.map((_, i) => (<Cell key={i} fill={PALETTE[i % PALETTE.length]} />))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      case "heatmap": {
        const days = Array.from(new Set(data.map((d) => d.day))) as string[];
        const hours = Array.from(new Set(data.map((d) => d.hour))) as number[];
        return (
          <div className="overflow-x-auto">
            <div className="grid gap-1" style={{ gridTemplateColumns: `56px repeat(${hours.length}, minmax(28px,1fr))` }}>
              <div />
              {hours.map((h) => (<div key={h} className="text-[10px] text-muted-foreground text-center">{h}:00</div>))}
              {days.map((d) => (
                <>
                  <div key={d} className="text-xs text-muted-foreground">{d}</div>
                  {hours.map((h) => {
                    const cell = data.find((x) => x.day === d && x.hour === h);
                    const v = Number(cell?.v ?? 0);
                    const alpha = Math.max(0.1, Math.min(1, v / 100));
                    return (
                      <div
                        key={`${d}-${h}`}
                        className="h-6 rounded"
                        style={{ background: `rgba(251,191,36,${alpha})` }}
                        title={`${d} ${h}:00 → ${v}%`}
                      />
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        );
      }
      case "table":
      default:
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border/60">
                  {Object.keys(data[0] ?? { t: "-" }).map((k) => (<th key={k} className="py-2 pr-3">{k}</th>))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b border-border/40">
                    {Object.values(row).map((v, j) => (<td key={j} className="py-2 pr-3 tabular-nums">{String(v)}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  })();

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{chart.title}</CardTitle>
        {chart.description && <p className="text-xs text-muted-foreground">{chart.description}</p>}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
