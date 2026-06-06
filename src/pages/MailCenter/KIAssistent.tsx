import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Copy, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'generate' | 'reply' | 'summarize' | 'lead_score' | 'campaign_optimize' | 'followup' | 'template_review';

const TONALITAETEN = ['Freundlich', 'Professionell', 'Seriös', 'Rechtlich', 'Verkauf', 'Mahnung', 'Technisch', 'Marketing'];
const ABTEILUNGEN = ['Finance', 'Vertrieb', 'Service', 'Marketing', 'Geschäftsführung'];
const SZENARIEN = [
  'Angebot geöffnet, keine Antwort',
  'Rechnung geöffnet, nicht bezahlt',
  'Ticket ungelöst',
  'Reparatur abgeschlossen, kein Feedback',
  'Termin steht aus',
];

async function callAI(mode: Mode, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('mail-ai-assistant', {
    body: { mode, ...payload },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any).result;
}

function JsonOut({ value }: { value: unknown }) {
  if (!value) return null;
  const json = JSON.stringify(value, null, 2);
  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2"
        onClick={() => { navigator.clipboard.writeText(json); toast.success('Kopiert'); }}
      >
        <Copy className="w-3 h-3" />
      </Button>
      <pre className="text-xs bg-muted/40 border border-border rounded-md p-3 overflow-auto max-h-[400px] whitespace-pre-wrap">
        {json}
      </pre>
    </div>
  );
}

function GenerateTab() {
  const [ziel, setZiel] = useState('');
  const [abteilung, setAbteilung] = useState('Vertrieb');
  const [kunde, setKunde] = useState('');
  const [tonalitaet, setTonalitaet] = useState('Professionell');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    if (!ziel.trim()) return toast.error('Ziel angeben');
    setLoading(true); setResult(null);
    try { setResult(await callAI('generate', { ziel, abteilung, kunde, tonalitaet })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Ziel der E-Mail</Label>
          <Textarea value={ziel} onChange={(e) => setZiel(e.target.value)} placeholder="z.B. Erstkontakt für neues Lasergerät bei Praxis Müller" rows={3} />
        </div>
        <div>
          <Label>Abteilung</Label>
          <Select value={abteilung} onValueChange={setAbteilung}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ABTEILUNGEN.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tonalität</Label>
          <Select value={tonalitaet} onValueChange={setTonalitaet}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TONALITAETEN.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Kunde / Empfänger (optional)</Label>
          <Input value={kunde} onChange={(e) => setKunde(e.target.value)} placeholder="Name, Praxis, Branche..." />
        </div>
      </div>
      <Button onClick={run} disabled={loading} className="bg-primary">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Mit KI erstellen
      </Button>
      <JsonOut value={result} />
    </div>
  );
}

function ReplyTab() {
  const [context, setContext] = useState('');
  const [history, setHistory] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const run = async () => {
    if (!context.trim()) return toast.error('Kundenanfrage einfügen');
    setLoading(true); setResult(null);
    try { setResult(await callAI('reply', { context, history })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-4">
      <div>
        <Label>Eingegangene Nachricht</Label>
        <Textarea rows={6} value={context} onChange={(e) => setContext(e.target.value)} />
      </div>
      <div>
        <Label>Zusatz-Kontext (Aufträge, Rechnungen, Tickets, Reparaturen)</Label>
        <Textarea rows={4} value={history} onChange={(e) => setHistory(e.target.value)} />
      </div>
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Antwortvorschlag erzeugen
      </Button>
      <JsonOut value={result} />
    </div>
  );
}

function SummarizeTab() {
  const [history, setHistory] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const run = async () => {
    if (!history.trim()) return toast.error('Verlauf einfügen');
    setLoading(true); setResult(null);
    try { setResult(await callAI('summarize', { history })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-4">
      <Label>Kompletter Kommunikationsverlauf</Label>
      <Textarea rows={10} value={history} onChange={(e) => setHistory(e.target.value)} placeholder="E-Mails / Notizen einfügen..." />
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Kommunikation zusammenfassen
      </Button>
      <JsonOut value={result} />
    </div>
  );
}

function LeadTab() {
  const [lead, setLead] = useState('{\n  "name": "",\n  "branche": "",\n  "geoeffnete_angebote": 0,\n  "klicks": 0,\n  "antworten": 0,\n  "letzter_kontakt": ""\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const run = async () => {
    setLoading(true); setResult(null);
    try {
      const parsed = JSON.parse(lead);
      setResult(await callAI('lead_score', { lead: parsed }));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-4">
      <Label>Lead-Daten (JSON)</Label>
      <Textarea rows={10} value={lead} onChange={(e) => setLead(e.target.value)} className="font-mono text-xs" />
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Lead bewerten
      </Button>
      <JsonOut value={result} />
    </div>
  );
}

function CampaignTab() {
  const [campaign, setCampaign] = useState('{\n  "name": "",\n  "oeffnungsrate": 0,\n  "klickrate": 0,\n  "abmeldungen": 0,\n  "bounce_rate": 0,\n  "betreff": "",\n  "zielgruppe": ""\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const run = async () => {
    setLoading(true); setResult(null);
    try {
      const parsed = JSON.parse(campaign);
      setResult(await callAI('campaign_optimize', { campaign: parsed }));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-4">
      <Label>Kampagnen-KPIs (JSON)</Label>
      <Textarea rows={10} value={campaign} onChange={(e) => setCampaign(e.target.value)} className="font-mono text-xs" />
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Kampagne optimieren
      </Button>
      <JsonOut value={result} />
    </div>
  );
}

function FollowupTab() {
  const [scenario, setScenario] = useState(SZENARIEN[0]);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const run = async () => {
    setLoading(true); setResult(null);
    try { setResult(await callAI('followup', { scenario, context })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-4">
      <div>
        <Label>Szenario</Label>
        <Select value={scenario} onValueChange={setScenario}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{SZENARIEN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Kontext / Details</Label>
        <Textarea rows={4} value={context} onChange={(e) => setContext(e.target.value)} placeholder="Auftragsnummer, Betrag, Frist..." />
      </div>
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Follow-Up vorschlagen
      </Button>
      <JsonOut value={result} />
    </div>
  );
}

function TemplateTab() {
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const run = async () => {
    if (!subject && !html) return toast.error('Betreff oder Inhalt angeben');
    setLoading(true); setResult(null);
    try { setResult(await callAI('template_review', { template: { subject, html } })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="space-y-4">
      <div><Label>Betreff</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
      <div><Label>HTML / Inhalt</Label><Textarea rows={8} value={html} onChange={(e) => setHtml(e.target.value)} /></div>
      <Button onClick={run} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Vorlage analysieren
      </Button>
      <JsonOut value={result} />
    </div>
  );
}

export default function KIAssistent() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Sparkles className="w-5 h-5 text-primary" /></div>
              <div>
                <CardTitle>Alix MailCenter – KI-Assistent</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Erstellt Vorschläge. Nichts wird automatisch versendet oder gespeichert.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1"><ShieldCheck className="w-3 h-3" /> Read-only KI</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="generate" className="w-full">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="generate">E-Mail Generator</TabsTrigger>
              <TabsTrigger value="reply">Antwortvorschlag</TabsTrigger>
              <TabsTrigger value="summarize">Zusammenfassung</TabsTrigger>
              <TabsTrigger value="lead">Vertriebs-Scoring</TabsTrigger>
              <TabsTrigger value="campaign">Kampagnen-Optimierung</TabsTrigger>
              <TabsTrigger value="followup">Follow-Up</TabsTrigger>
              <TabsTrigger value="template">Vorlagen-Check</TabsTrigger>
            </TabsList>
            <div className="mt-6">
              <TabsContent value="generate"><GenerateTab /></TabsContent>
              <TabsContent value="reply"><ReplyTab /></TabsContent>
              <TabsContent value="summarize"><SummarizeTab /></TabsContent>
              <TabsContent value="lead"><LeadTab /></TabsContent>
              <TabsContent value="campaign"><CampaignTab /></TabsContent>
              <TabsContent value="followup"><FollowupTab /></TabsContent>
              <TabsContent value="template"><TemplateTab /></TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
