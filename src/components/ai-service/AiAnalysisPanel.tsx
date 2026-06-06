import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, FileDown, Wrench, Clock, UserCheck, Package, ThumbsUp, ThumbsDown, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Analysis = {
  id: string;
  ticket_id: string | null;
  repair_id: string | null;
  serial_number: string | null;
  device_name: string | null;
  error_description: string | null;
  probable_cause: string | null;
  confidence_score: number | null;
  recommended_steps: string[] | null;
  recommended_repair: string | null;
  recommended_parts: Array<{ name: string; probability: number; reason?: string; stock?: number; lead_time_days?: number }> | null;
  estimated_diagnosis_time_minutes: number | null;
  estimated_repair_time_minutes: number | null;
  estimated_total_time_minutes: number | null;
  recommended_technician: string | null;
  ai_model: string | null;
  created_at: string;
};

interface Props {
  sourceKind: 'ticket' | 'repair';
  recordId: string;
  trigger?: React.ReactNode;
}

export function AiAnalysisPanel({ sourceKind, recordId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => { if (open) loadLatest(); }, [open, recordId]);

  async function loadLatest() {
    const field = sourceKind === 'ticket' ? 'ticket_id' : 'repair_id';
    const { data } = await supabase
      .from('ai_service_analyses' as any)
      .select('*')
      .eq(field, recordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setAnalysis(data as any);
  }

  async function runAnalysis() {
    setLoading(true);
    setFeedbackSent(false);
    try {
      const payload: any = {};
      if (sourceKind === 'ticket') payload.ticket_id = recordId;
      else payload.repair_id = recordId;
      const { data, error } = await supabase.functions.invoke('ai-service-analyze', { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnalysis((data as any).analysis);
      toast.success('AI-Analyse erstellt');
    } catch (e: any) {
      toast.error(`Analyse fehlgeschlagen: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  async function downloadGuidePdf() {
    if (!analysis) return;
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
    addH(`Reparaturanleitung – ${analysis.device_name ?? 'Gerät'}`);
    addP(`Seriennummer: ${analysis.serial_number ?? '–'}`);
    addP(`Wahrscheinliche Ursache: ${analysis.probable_cause ?? '–'}`);
    y += 3;

    const sections: Array<[string, string[]]> = [
      ['1. Sicherheitsprüfung', ['Stromzufuhr trennen', 'Schutzkleidung anlegen', 'Arbeitsplatz prüfen']],
      ['2. Sichtprüfung', ['Gehäuse und Kabel prüfen', 'Sichtbare Beschädigungen dokumentieren']],
      ['3. Diagnose', analysis.recommended_steps ?? []],
      ['4. Reparaturschritte', analysis.recommended_repair ? [analysis.recommended_repair] : []],
      ['5. Abschlussprüfung', ['Alle Verbindungen prüfen', 'Schutzmaßnahmen wiederherstellen']],
      ['6. Funktionstest', ['Gerät einschalten', 'Funktionen testen', 'Messwerte dokumentieren']],
      ['7. Dokumentation', ['Maßnahmen im Reparaturauftrag erfassen', 'Ersatzteile buchen']],
    ];
    sections.forEach(([title, items]) => {
      addH(title);
      (items.length ? items : ['—']).forEach((it, i) => addP(`${i + 1}. ${it}`));
      y += 2;
    });
    doc.save(`reparaturanleitung_${analysis.serial_number ?? analysis.id}.pdf`);
  }

  async function sendFeedback(rating: 1 | -1) {
    if (!analysis) return;
    const { error } = await supabase.from('service_ai_feedback' as any).insert({
      analysis_id: analysis.id, rating,
    } as any);
    if (error) { toast.error(error.message); return; }
    setFeedbackSent(true);
    toast.success('Danke für dein Feedback');
  }

  function copyOrderProposal() {
    if (!analysis?.recommended_parts?.length) return;
    const lines = analysis.recommended_parts.map((p) => `- ${p.name}  (Wahrscheinlichkeit ${p.probability}%)`);
    navigator.clipboard.writeText(`Bestellvorschlag für ${analysis.serial_number ?? ''}\n${lines.join('\n')}`);
    toast.success('Bestellvorschlag in Zwischenablage kopiert');
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> AI Fehleranalyse starten
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" /> AI Service Assistent
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-wrap items-center gap-2 my-4">
          <Button onClick={runAnalysis} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analysis ? 'Analyse aktualisieren' : 'AI Fehleranalyse starten'}
          </Button>
          {analysis && (
            <>
              <Button variant="outline" onClick={downloadGuidePdf} className="gap-2">
                <FileDown className="w-4 h-4" /> Reparaturanleitung als PDF
              </Button>
              <Button variant="outline" onClick={copyOrderProposal} className="gap-2" disabled={!analysis.recommended_parts?.length}>
                <Package className="w-4 h-4" /> Bestellvorschlag erzeugen
              </Button>
              <Button variant="outline" onClick={loadLatest} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Neu laden
              </Button>
            </>
          )}
        </div>

        {!analysis && !loading && (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
            Noch keine Analyse vorhanden. Klicke „AI Fehleranalyse starten".
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
                  Vertrauen: {Math.round(analysis.confidence_score ?? 0)}%
                </Badge>
                <span className="text-xs text-muted-foreground">{new Date(analysis.created_at).toLocaleString('de-DE')}</span>
                {analysis.ai_model && <Badge variant="outline" className="text-[10px]">{analysis.ai_model}</Badge>}
              </div>
              <Section title="Wahrscheinliche Ursache">{analysis.probable_cause ?? '—'}</Section>
              <Section title="Reparaturempfehlung">{analysis.recommended_repair ?? '—'}</Section>
              {analysis.recommended_steps?.length ? (
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Prüfschritte</div>
                  <ol className="list-decimal pl-5 space-y-1 text-sm">
                    {analysis.recommended_steps.map((s, i) => <li key={i}>{s}</li>)}
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
              {(analysis.recommended_parts ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">Keine Ersatzteile vorgeschlagen.</div>
              )}
              {(analysis.recommended_parts ?? []).map((p, i) => (
                <div key={i} className="border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    {p.reason && <div className="text-xs text-muted-foreground truncate">{p.reason}</div>}
                    <div className="flex gap-2 mt-1">
                      {typeof p.stock === 'number' && <Badge variant="outline" className="text-[10px]">Lager: {p.stock}</Badge>}
                      {typeof p.lead_time_days === 'number' && <Badge variant="outline" className="text-[10px]">Lieferzeit: {p.lead_time_days} Tage</Badge>}
                    </div>
                  </div>
                  <Badge variant="outline">{p.probability}%</Badge>
                </div>
              ))}
              {(analysis.recommended_parts ?? []).length > 0 && (
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={copyOrderProposal}>
                  <Package className="w-4 h-4" /> Bestellvorschlag erzeugen
                </Button>
              )}
            </TabsContent>

            <TabsContent value="guide" className="space-y-3 mt-4">
              <div className="text-sm text-muted-foreground">
                Strukturierte Reparaturanleitung in 7 Schritten – nutze „Reparaturanleitung als PDF" zum Export.
              </div>
              <ol className="list-decimal pl-5 text-sm space-y-1">
                <li>Sicherheitsprüfung</li>
                <li>Sichtprüfung</li>
                <li>Diagnose</li>
                <li>Reparaturschritte</li>
                <li>Abschlussprüfung</li>
                <li>Funktionstest</li>
                <li>Dokumentation</li>
              </ol>
              <Button variant="outline" onClick={downloadGuidePdf} className="gap-2">
                <FileDown className="w-4 h-4" /> Als PDF herunterladen
              </Button>
            </TabsContent>

            <TabsContent value="time" className="mt-4">
              <div className="grid grid-cols-3 gap-3">
                <TimeCard label="Diagnose" v={analysis.estimated_diagnosis_time_minutes} />
                <TimeCard label="Reparatur" v={analysis.estimated_repair_time_minutes} highlight />
                <TimeCard label="Gesamt" v={analysis.estimated_total_time_minutes} />
              </div>
            </TabsContent>

            <TabsContent value="tech" className="mt-4 space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Empfohlener Techniker / Rolle: </span>
                <span className="font-medium">{analysis.recommended_technician ?? '—'}</span>
              </div>
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

function TimeCard({ label, v, highlight }: { label: string; v?: number | null; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${highlight ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{v ?? '—'} <span className="text-xs text-muted-foreground">min</span></div>
    </div>
  );
}

export default AiAnalysisPanel;
