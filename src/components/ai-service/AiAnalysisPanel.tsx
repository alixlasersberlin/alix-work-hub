import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, FileDown, Wrench, Clock, UserCheck, Package, ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

type Analysis = {
  id: string;
  ursache: string | null;
  confidence: number | null;
  pruefschritte: string[] | null;
  reparatur_empfehlung: string | null;
  ersatzteile: Array<{ name: string; wahrscheinlichkeit: number; begruendung?: string }> | null;
  arbeitszeit: { min_minuten?: number; erwartet_minuten?: number; max_minuten?: number } | null;
  technikerempfehlung: { rolle?: string; begruendung?: string } | null;
  created_at: string;
};

type Guide = {
  id: string;
  titel: string | null;
  pruefschritte: string[] | null;
  reparaturschritte: string[] | null;
  sicherheit: string[] | null;
  abschlusspruefung: string[] | null;
};

interface Props {
  sourceKind: 'ticket' | 'repair';
  recordId: string;
  trigger?: React.ReactNode;
}

export function AiAnalysisPanel({ sourceKind, recordId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guideLoading, setGuideLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadLatest();
  }, [open, recordId]);

  async function loadLatest() {
    const field = sourceKind === 'ticket' ? 'ticket_id' : 'repair_order_id';
    const { data } = await supabase
      .from('service_ai_analyses' as any)
      .select('*')
      .eq(field, recordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setAnalysis(data as any);
      const { data: g } = await supabase
        .from('service_ai_repair_guides' as any)
        .select('*')
        .eq('analysis_id', (data as any).id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (g) setGuide(g as any);
    }
  }

  async function runAnalysis() {
    setLoading(true);
    setFeedbackSent(false);
    try {
      const { data, error } = await supabase.functions.invoke('service-ai-analyze', {
        body: { source_kind: sourceKind, id: recordId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnalysis((data as any).analysis);
      setGuide(null);
      toast.success('AI-Analyse erstellt');
    } catch (e: any) {
      toast.error(`Analyse fehlgeschlagen: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  async function runGuide() {
    if (!analysis) return;
    setGuideLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('service-ai-repair-guide', {
        body: { analysis_id: analysis.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGuide((data as any).guide);
      toast.success('Anleitung erstellt');
    } catch (e: any) {
      toast.error(`Anleitung fehlgeschlagen: ${e?.message ?? e}`);
    } finally {
      setGuideLoading(false);
    }
  }

  async function downloadPdf() {
    if (!guide) return;
    const jsPDFMod: any = await import('jspdf');
    const JsPDF = jsPDFMod.jsPDF ?? jsPDFMod.default;
    const doc = new JsPDF();
    let y = 15;
    const addH = (t: string) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(t, 14, y); y += 7; };
    const addP = (t: string) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const lines = doc.splitTextToSize(t, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 2;
      if (y > 270) { doc.addPage(); y = 15; }
    };
    addH(guide.titel ?? 'Reparaturanleitung');
    const sections: Array<[string, string[] | null]> = [
      ['Sicherheit', guide.sicherheit],
      ['Prüfschritte', guide.pruefschritte],
      ['Reparaturschritte', guide.reparaturschritte],
      ['Abschlussprüfung', guide.abschlusspruefung],
    ];
    sections.forEach(([title, items]) => {
      addH(title);
      (items ?? []).forEach((it, i) => addP(`${i + 1}. ${it}`));
      y += 3;
    });
    doc.save(`${(guide.titel ?? 'reparaturanleitung').replace(/[^a-z0-9\-_]+/gi, '_')}.pdf`);
  }

  async function sendFeedback(rating: 1 | -1) {
    if (!analysis) return;
    const { error } = await supabase.from('service_ai_feedback' as any).insert({
      analysis_id: analysis.id,
      rating,
    });
    if (error) { toast.error(error.message); return; }
    setFeedbackSent(true);
    toast.success('Danke für dein Feedback');
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> AI Fehleranalyse
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> AI Service Assistent
          </SheetTitle>
        </SheetHeader>

        <div className="flex items-center gap-2 my-4">
          <Button onClick={runAnalysis} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analysis ? 'Analyse neu erstellen' : 'Analyse starten'}
          </Button>
          {analysis && (
            <Button variant="outline" onClick={runGuide} disabled={guideLoading} className="gap-2">
              {guideLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              Anleitung erzeugen
            </Button>
          )}
          {guide && (
            <Button variant="outline" onClick={downloadPdf} className="gap-2">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
          )}
        </div>

        {!analysis && !loading && (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
            Noch keine Analyse vorhanden. Klicke „Analyse starten".
          </div>
        )}

        {analysis && (
          <Tabs defaultValue="analyse" className="mt-2">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="analyse">Analyse</TabsTrigger>
              <TabsTrigger value="parts"><Package className="w-3 h-3 mr-1" />Teile</TabsTrigger>
              <TabsTrigger value="guide"><Wrench className="w-3 h-3 mr-1" />Anleitung</TabsTrigger>
              <TabsTrigger value="time"><Clock className="w-3 h-3 mr-1" />Zeit</TabsTrigger>
              <TabsTrigger value="tech"><UserCheck className="w-3 h-3 mr-1" />Techniker</TabsTrigger>
            </TabsList>

            <TabsContent value="analyse" className="space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/40">
                  Vertrauen: {analysis.confidence ?? 0}%
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(analysis.created_at).toLocaleString('de-DE')}
                </span>
              </div>
              <Section title="Wahrscheinliche Ursache">{analysis.ursache ?? '—'}</Section>
              <Section title="Empfohlene Reparatur">{analysis.reparatur_empfehlung ?? '—'}</Section>
              {analysis.pruefschritte?.length ? (
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Prüfschritte</div>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    {analysis.pruefschritte.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
              ) : null}
              {!feedbackSent && (
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">War das hilfreich?</span>
                  <Button variant="ghost" size="sm" onClick={() => sendFeedback(1)}><ThumbsUp className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => sendFeedback(-1)}><ThumbsDown className="w-4 h-4" /></Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="parts" className="space-y-2 mt-4">
              {(analysis.ersatzteile ?? []).length === 0 && <div className="text-sm text-muted-foreground">Keine Ersatzteile vorgeschlagen.</div>}
              {(analysis.ersatzteile ?? []).map((p, i) => (
                <div key={i} className="border border-border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    {p.begruendung && <div className="text-xs text-muted-foreground">{p.begruendung}</div>}
                  </div>
                  <Badge variant="outline">{p.wahrscheinlichkeit}%</Badge>
                </div>
              ))}
              {(analysis.ersatzteile ?? []).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => toast.info('Bestellvorschlag-Vorschau – bitte über das Bestellwesen final anlegen.')}
                >
                  Bestellvorschlag erzeugen
                </Button>
              )}
            </TabsContent>

            <TabsContent value="guide" className="space-y-3 mt-4">
              {!guide && <div className="text-sm text-muted-foreground">Noch keine Anleitung – klicke „Anleitung erzeugen".</div>}
              {guide && (
                <>
                  <div className="font-semibold">{guide.titel}</div>
                  <GuideSection title="Sicherheit" items={guide.sicherheit} />
                  <GuideSection title="Prüfschritte" items={guide.pruefschritte} />
                  <GuideSection title="Reparaturschritte" items={guide.reparaturschritte} />
                  <GuideSection title="Abschlussprüfung" items={guide.abschlusspruefung} />
                </>
              )}
            </TabsContent>

            <TabsContent value="time" className="mt-4 space-y-2">
              {analysis.arbeitszeit ? (
                <div className="grid grid-cols-3 gap-3">
                  <TimeCard label="Minimum" v={analysis.arbeitszeit.min_minuten} />
                  <TimeCard label="Erwartet" v={analysis.arbeitszeit.erwartet_minuten} highlight />
                  <TimeCard label="Maximum" v={analysis.arbeitszeit.max_minuten} />
                </div>
              ) : <div className="text-sm text-muted-foreground">Keine Zeitschätzung verfügbar.</div>}
            </TabsContent>

            <TabsContent value="tech" className="mt-4 space-y-2">
              {analysis.technikerempfehlung ? (
                <>
                  <div className="text-sm"><span className="text-muted-foreground">Empfohlene Rolle: </span><span className="font-medium">{analysis.technikerempfehlung.rolle ?? '—'}</span></div>
                  <div className="text-sm text-muted-foreground">{analysis.technikerempfehlung.begruendung}</div>
                </>
              ) : <div className="text-sm text-muted-foreground">Keine Empfehlung verfügbar.</div>}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{title}</div>
      <div className="text-sm whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function GuideSection({ title, items }: { title: string; items: string[] | null }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{title}</div>
      <ol className="list-decimal pl-5 space-y-1 text-sm">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

function TimeCard({ label, v, highlight }: { label: string; v?: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${highlight ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{v ?? '—'} <span className="text-xs text-muted-foreground">min</span></div>
    </div>
  );
}

export default AiAnalysisPanel;
