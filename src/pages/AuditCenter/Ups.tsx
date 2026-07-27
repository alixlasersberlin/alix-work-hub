import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, Zap, Award } from "lucide-react";
import { logAuditAccess } from "./audit-access";

type Score = {
  user_id: string;
  label: string;
  actions: number;
  activeHours: number;
  modulesTouched: number;
  consistency: number;
  score: number;
};

export default function AuditUps() {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logAuditAccess("ups");
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [actionsRes, profilesRes] = await Promise.all([
        supabase
          .from("audit_actions")
          .select("user_id, module, ts, duration_ms")
          .gte("ts", since)
          .limit(20000),
        supabase.from("user_profiles").select("id, email, full_name").limit(500),
      ]);

      const profiles = new Map<string, any>();
      (profilesRes.data ?? []).forEach((p: any) => profiles.set(p.id, p));

      const agg = new Map<string, { actions: number; hours: Set<string>; modules: Set<string>; days: Set<string> }>();
      (actionsRes.data ?? []).forEach((a: any) => {
        if (!a.user_id) return;
        if (!agg.has(a.user_id)) agg.set(a.user_id, { actions: 0, hours: new Set(), modules: new Set(), days: new Set() });
        const g = agg.get(a.user_id)!;
        g.actions++;
        const d = new Date(a.ts);
        g.hours.add(`${d.toISOString().slice(0, 10)}-${d.getHours()}`);
        g.days.add(d.toISOString().slice(0, 10));
        if (a.module) g.modules.add(a.module);
      });

      const maxAct = Math.max(1, ...Array.from(agg.values()).map((g) => g.actions));
      const list: Score[] = [];
      agg.forEach((g, uid) => {
        const actScore = (g.actions / maxAct) * 40;
        const hourScore = Math.min(g.hours.size / 200, 1) * 25;
        const modScore = Math.min(g.modules.size / 10, 1) * 15;
        const consScore = Math.min(g.days.size / 22, 1) * 20;
        const total = Math.round(actScore + hourScore + modScore + consScore);
        const p = profiles.get(uid);
        list.push({
          user_id: uid,
          label: p?.full_name || p?.email || uid.slice(0, 8),
          actions: g.actions,
          activeHours: g.hours.size,
          modulesTouched: g.modules.size,
          consistency: g.days.size,
          score: total,
        });
      });
      list.sort((a, b) => b.score - a.score);
      setScores(list);
      setLoading(false);
    })();
  }, []);

  const top3 = scores.slice(0, 3);
  const avg = useMemo(
    () => (scores.length ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : 0),
    [scores],
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
          Ultimate Productivity Score
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Composite Score (0–100): 40 % Aktionen · 25 % aktive Stunden · 15 % Module · 20 % Konsistenz
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {top3.map((s, i) => (
          <Card
            key={s.user_id}
            className={`border-border/60 bg-gradient-to-br backdrop-blur-xl ${
              i === 0
                ? "from-amber-500/20 to-yellow-600/10 border-amber-500/40"
                : i === 1
                  ? "from-slate-400/15 to-slate-600/5 border-slate-400/30"
                  : "from-orange-700/15 to-amber-800/5 border-orange-600/30"
            }`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                {i === 0 ? <Trophy className="h-5 w-5 text-amber-300" /> : <Award className="h-5 w-5" />}
                <span className="text-base truncate">{s.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
                {s.score}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {s.actions} Aktionen · {s.consistency} aktive Tage
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Team-Ranking ({scores.length} Mitarbeiter)
          </CardTitle>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" /> Durchschnitt: {avg}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {scores.slice(0, 30).map((s, i) => (
            <div key={s.user_id} className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                  <span className="font-medium truncate max-w-[240px]">{s.label}</span>
                </span>
                <span className="text-amber-300 font-mono">{s.score}</span>
              </div>
              <Progress value={s.score} className="h-1.5" />
            </div>
          ))}
          {!loading && scores.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Noch keine Daten</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
