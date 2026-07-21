import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClipboardCheck, Plus, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

type Session = {
  id: string; title: string; status: string; target_variance: number;
  scorecard_id: string | null; created_at: string; closed_at: string | null;
};
type Score = { id: string; session_id: string; rater_id: string; score: number; comment: string | null };

function variance(scores: number[]) {
  if (scores.length < 2) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);
}

export default function QmCalibration() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [scores, setScores] = useState<Record<string, Score[]>>({});
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("10");
  const [rating, setRating] = useState<Record<string, string>>({});
  const [comment, setComment] = useState<Record<string, string>>({});

  async function load() {
    const { data: s } = await supabase.from("ac_qm_calibration_sessions")
      .select("*").order("created_at", { ascending: false }).limit(50);
    setSessions((s ?? []) as Session[]);
    if (s?.length) {
      const { data: sc } = await supabase.from("ac_qm_calibration_scores")
        .select("*").in("session_id", s.map((x: any) => x.id));
      const map: Record<string, Score[]> = {};
      (sc ?? []).forEach((row: any) => { (map[row.session_id] ??= []).push(row); });
      setScores(map);
    }
  }
  useEffect(() => { load(); }, []);

  async function createSession() {
    if (!title.trim()) return;
    const { error } = await supabase.from("ac_qm_calibration_sessions")
      .insert({ title, target_variance: Number(target) || 10 });
    if (error) return toast.error(error.message);
    toast.success("Session erstellt");
    setOpen(false); setTitle(""); setTarget("10"); load();
  }

  async function submitScore(sessionId: string) {
    const s = Number(rating[sessionId]);
    if (isNaN(s)) return toast.error("Score eingeben");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("ac_qm_calibration_scores")
      .upsert({ session_id: sessionId, rater_id: u.user!.id, score: s, comment: comment[sessionId] ?? null }, { onConflict: "session_id,rater_id" });
    if (error) return toast.error(error.message);
    toast.success("Bewertung abgegeben");
    setRating({ ...rating, [sessionId]: "" }); setComment({ ...comment, [sessionId]: "" });
    load();
  }

  async function closeSession(id: string) {
    await supabase.from("ac_qm_calibration_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">QM Kalibrierung</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Neue Session</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Kalibrierungs-Session</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Call #4712 – Reklamation" /></div>
              <div><Label>Ziel-Standardabweichung (Punkte)</Label><Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
              <Button onClick={createSession}>Erstellen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Kalibrierungs-Sessions.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sessions.map((s) => {
          const rows = scores[s.id] ?? [];
          const vals = rows.map((r) => Number(r.score));
          const sd = variance(vals);
          const mean = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
          const ok = sd <= s.target_variance;
          return (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{s.title}</CardTitle>
                  <Badge variant={s.status === "closed" ? "secondary" : "outline"}>{s.status}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{rows.length} Bewerter</span>
                  <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />Ø {mean.toFixed(1)} · σ {sd.toFixed(2)}</span>
                  <Badge variant={ok ? "default" : "destructive"} className="text-[10px]">{ok ? "Kalibriert" : `Ziel σ ≤ ${s.target_variance}`}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 max-h-32 overflow-auto">
                  {rows.map((r) => (
                    <div key={r.id} className="text-xs flex justify-between border-b border-border/40 py-1">
                      <span className="font-mono">{r.rater_id.slice(0,8)}</span>
                      <span className="font-medium">{Number(r.score).toFixed(1)}</span>
                    </div>
                  ))}
                </div>
                {s.status !== "closed" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input type="number" step="0.5" placeholder="Score" value={rating[s.id] ?? ""} onChange={(e) => setRating({ ...rating, [s.id]: e.target.value })} className="w-24" />
                      <Input placeholder="Kommentar (optional)" value={comment[s.id] ?? ""} onChange={(e) => setComment({ ...comment, [s.id]: e.target.value })} />
                      <Button size="sm" onClick={() => submitScore(s.id)}>Abgeben</Button>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => closeSession(s.id)}>Session schließen</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
