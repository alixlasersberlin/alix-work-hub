import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useAfterSalesCase, useToggleChecklistItem, useUpdateMediaStage,
  useAddCallback, useCompleteCallback, useCloseCase, useForceCloseCase, type AsSection,
} from '@/hooks/useAfterSales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft, Phone, Mail, CheckCircle2, Calendar, Sparkles, AlertTriangle, Star, ExternalLink, Smartphone,
  ShieldCheck, Wrench, Image as ImageIcon, GraduationCap, Megaphone, HeartPulse, TrendingUp, Send, MessageSquare,
} from 'lucide-react';

const SECTION_META: Record<AsSection, { label: string; icon: any }> = {
  erstkontakt: { label: 'Erstkontakt', icon: Phone },
  geraet: { label: 'Gerät', icon: Wrench },
  nisv: { label: 'NiSV', icon: ShieldCheck },
  app: { label: 'Alix Smart App', icon: Smartphone },
  mediapaket: { label: 'Mediapaket', icon: ImageIcon },
  schulung: { label: 'Schulung', icon: GraduationCap },
  marketing: { label: 'Marketing', icon: Megaphone },
  zufriedenheit: { label: 'Zufriedenheit', icon: HeartPulse },
  rueckruf: { label: 'Rückruf', icon: Phone },
  upselling: { label: 'Upselling', icon: TrendingUp },
};

const MEDIA_STAGES: Array<{ value: string; label: string }> = [
  { value: 'not_started', label: 'Nicht begonnen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'data_requested', label: 'Daten angefordert' },
  { value: 'data_received', label: 'Daten erhalten' },
  { value: 'graphics_done', label: 'Grafiken erstellt' },
  { value: 'homepage_done', label: 'Homepage eingebunden' },
  { value: 'social_done', label: 'Social Media erstellt' },
  { value: 'google_done', label: 'Google Business eingerichtet' },
  { value: 'done', label: 'Abgeschlossen' },
  { value: 'skipped', label: 'Bewusst übersprungen' },
];

export default function AfterSalesCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useAfterSalesCase(id);
  const toggle = useToggleChecklistItem();
  const updateMedia = useUpdateMediaStage();
  const addCallback = useAddCallback();
  const completeCallback = useCompleteCallback();
  const closeCase = useCloseCase();
  const forceClose = useForceCloseCase();

  const [cbDate, setCbDate] = useState('');
  const [cbReason, setCbReason] = useState('');

  if (isLoading || !data?.case) return <div className="p-4 text-sm text-muted-foreground">Lade After-Sales-Akte…</div>;
  const c = data.case;
  const lightColor = c.traffic_light === 'green' ? 'bg-emerald-500' : c.traffic_light === 'yellow' ? 'bg-amber-400' : 'bg-rose-500';

  const grouped: Record<string, typeof data.checklist> = {};
  data.checklist.forEach((i) => { (grouped[i.section] ??= [] as any).push(i); });

  const sections: AsSection[] = ['erstkontakt', 'geraet', 'nisv', 'app', 'schulung', 'marketing', 'zufriedenheit'];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/crm/after-sales"><ArrowLeft className="w-4 h-4 mr-1" /> Zurück</Link></Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-full ${lightColor}`} />
                <h1 className="text-xl font-semibold">
                  {c.customer_company ?? c.customer_contact ?? 'Kunde'} {c.is_vip && <Star className="inline w-4 h-4 text-amber-500 fill-amber-500" />}
                </h1>
                <Badge variant="outline">{c.status}</Badge>
                <Badge>{c.priority}</Badge>
              </div>
              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                <span>Auftrag <Link className="text-primary hover:underline" to={`/auftraege/${c.order_id}`}>{c.order_number ?? '—'}</Link></span>
                {c.customer_id && <span>Kunde <Link className="text-primary hover:underline" to={`/kunden/${c.customer_id}`}>{c.customer_number ?? c.customer_company} <ExternalLink className="inline w-3 h-3" /></Link></span>}
                {c.customer_phone && <span><Phone className="inline w-3 h-3 mr-1" />{c.customer_phone}</span>}
                {c.customer_email && <span><Mail className="inline w-3 h-3 mr-1" />{c.customer_email}</span>}
                {c.device_model && <span><Wrench className="inline w-3 h-3 mr-1" />{c.device_model} {c.device_serial ? `(SN ${c.device_serial})` : ''}</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 min-w-[200px]">
              <div className="text-xs text-muted-foreground">Fortschritt</div>
              <div className="w-48 h-2 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${c.progress_pct ?? 0}%` }} />
              </div>
              <div className="text-sm font-medium">{c.progress_pct ?? 0}%</div>
              <Button size="sm" onClick={() => id && closeCase.mutate(id)} disabled={c.status === 'completed' || closeCase.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Fall abschließen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="checkliste" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="checkliste">Checkliste</TabsTrigger>
          <TabsTrigger value="ki">KI-Analyse</TabsTrigger>
          <TabsTrigger value="mediapaket">Mediapaket</TabsTrigger>
          <TabsTrigger value="kommunikation">Kommunikation</TabsTrigger>
          <TabsTrigger value="rueckrufe">Rückrufe</TabsTrigger>
          <TabsTrigger value="upselling">Upselling</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="ki">
          <AiSuggestPanel caseId={c.id} healthScore={c.health_score} />
        </TabsContent>


        <TabsContent value="checkliste" className="space-y-3">
          {sections.map((sec) => {
            const Meta = SECTION_META[sec];
            const items = grouped[sec] ?? [];
            if (items.length === 0) return null;
            return (
              <Card key={sec}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Meta.icon className="w-4 h-4 text-primary" /> {Meta.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((it: any) => (
                    <label key={it.id} className="flex items-center gap-3 text-sm cursor-pointer">
                      <Checkbox checked={it.checked} onCheckedChange={(v) => toggle.mutate({ id: it.id, case_id: c.id, checked: !!v })} />
                      <span className={it.checked ? 'line-through text-muted-foreground' : ''}>{it.label}</span>
                      {it.checked_at && <span className="text-xs text-muted-foreground ml-auto">{new Date(it.checked_at).toLocaleDateString('de-DE')}</span>}
                    </label>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="mediapaket">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" /> Mediapaket-Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">Aktueller Status: <span className="font-medium text-foreground">{MEDIA_STAGES.find(s => s.value === data.media?.stage)?.label ?? 'Nicht begonnen'}</span></div>
              <Select value={data.media?.stage ?? 'not_started'} onValueChange={(v) => updateMedia.mutate({ case_id: c.id, stage: v })}>
                <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{MEDIA_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kommunikation" className="space-y-3">
          <CommunicationPanel caseId={c.id} email={c.customer_email} phone={c.customer_phone} />
        </TabsContent>



        <TabsContent value="rueckrufe" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Neuen Rückruf planen</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid md:grid-cols-3 gap-2">
                <Input type="datetime-local" value={cbDate} onChange={(e) => setCbDate(e.target.value)} />
                <Input placeholder="Grund / Notiz" value={cbReason} onChange={(e) => setCbReason(e.target.value)} className="md:col-span-2" />
              </div>
              <Button size="sm" disabled={!cbDate}
                onClick={() => {
                  addCallback.mutate({ case_id: c.id, due_at: new Date(cbDate).toISOString(), priority: 'normal', reason: cbReason });
                  setCbDate(''); setCbReason('');
                }}>
                <Calendar className="w-4 h-4 mr-1" /> Rückruf eintragen
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Rückrufe</CardTitle></CardHeader>
            <CardContent>
              {data.callbacks.length === 0 ? <p className="text-sm text-muted-foreground">Keine Rückrufe geplant.</p> : (
                <ul className="space-y-2">
                  {data.callbacks.map((cb: any) => {
                    const overdue = !cb.done_at && new Date(cb.due_at) < new Date();
                    return (
                      <li key={cb.id} className="flex items-center justify-between border-b pb-2 text-sm">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {overdue && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                            {new Date(cb.due_at).toLocaleString('de-DE')}
                          </div>
                          {cb.reason && <div className="text-xs text-muted-foreground">{cb.reason}</div>}
                        </div>
                        {cb.done_at ? <Badge variant="secondary">erledigt</Badge>
                          : <Button size="sm" variant="outline" onClick={() => completeCallback.mutate({ id: cb.id, case_id: c.id })}>Erledigt</Button>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upselling">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Upselling-Vorschläge</CardTitle></CardHeader>
            <CardContent>
              {data.upsell.length === 0 ? (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Empfohlene Folgeprodukte: HIFU · Carbon Laser · Hydrafacial · EMS · Cellulite · Wartungsvertrag · Kartuschen · Handstücke · Marketingpaket · Finanzierung.</p>
                  <p className="text-xs">Die KI-gestützten Vorschläge werden in Phase 3 automatisch erzeugt.</p>
                </div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.upsell.map((u: any) => <li key={u.id} className="flex justify-between border-b py-1"><span>{u.label}</span>{u.accepted != null && <Badge variant={u.accepted ? 'default' : 'secondary'}>{u.accepted ? 'angenommen' : 'abgelehnt'}</Badge>}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader><CardTitle className="text-sm">Verlauf</CardTitle></CardHeader>
            <CardContent>
              {data.timeline.length === 0 ? <p className="text-sm text-muted-foreground">Keine Einträge.</p> : (
                <ol className="space-y-3">
                  {data.timeline.map((t: any) => (
                    <li key={t.id} className="border-l-2 border-primary/40 pl-3">
                      <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString('de-DE')} · {t.source}</div>
                      <div className="text-sm font-medium">{t.title}</div>
                      {t.body && <div className="text-xs text-muted-foreground">{t.body}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ReminderKind = 'app' | 'nisv' | 'schulung' | 'mediapaket' | 'feedback' | 'callback' | 'generic';

const KIND_LABELS: Array<{ value: ReminderKind; label: string; icon: any }> = [
  { value: 'app', label: 'App-Installation', icon: Smartphone },
  { value: 'nisv', label: 'NiSV-Nachweis', icon: ShieldCheck },
  { value: 'schulung', label: 'Schulungstermin', icon: GraduationCap },
  { value: 'mediapaket', label: 'Mediapaket', icon: ImageIcon },
  { value: 'feedback', label: 'Zufriedenheits-Feedback', icon: HeartPulse },
  { value: 'callback', label: 'Rückruf-Bitte', icon: Phone },
  { value: 'generic', label: 'Allgemeine Nachricht', icon: Megaphone },
];

function CommunicationPanel({ caseId, email, phone }: { caseId: string; email?: string | null; phone?: string | null }) {
  const [kind, setKind] = useState<ReminderKind>('app');
  const [customMessage, setCustomMessage] = useState('');
  const [customSms, setCustomSms] = useState('');
  const [busy, setBusy] = useState<'email' | 'sms' | null>(null);

  async function send(channel: 'email' | 'sms') {
    setBusy(channel);
    try {
      const fn = channel === 'email' ? 'as-send-email-reminder' : 'as-send-sms-reminder';
      const body: any = { case_id: caseId, kind };
      if (channel === 'email' && customMessage.trim()) body.custom_message = customMessage.trim();
      if (channel === 'sms' && customSms.trim()) body.custom_text = customSms.trim();
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error || (data as any)?.error) throw new Error(error?.message ?? (data as any)?.error ?? 'Fehler');
      toast.success(channel === 'email' ? 'Email gesendet' : 'SMS gesendet');
    } catch (e: any) {
      toast.error(e?.message ?? 'Versand fehlgeschlagen');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Erinnerung versenden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Anlass</label>
            <Select value={kind} onValueChange={(v) => setKind(v as ReminderKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_LABELS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2"><Mail className="w-3 h-3" /> {email ?? 'keine Email hinterlegt'}</div>
            <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {phone ?? 'keine Mobilnummer'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Email-Erinnerung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            placeholder="Optionaler individueller Text (überschreibt Standard-Erinnerung)"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={4}
          />
          <Button size="sm" disabled={!email || busy === 'email'} onClick={() => send('email')}>
            <Send className="w-4 h-4 mr-1" /> {busy === 'email' ? 'Sende…' : 'Email senden'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> SMS-Erinnerung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            placeholder="Optionaler individueller SMS-Text"
            value={customSms}
            onChange={(e) => setCustomSms(e.target.value)}
            rows={3}
            maxLength={480}
          />
          <Button size="sm" variant="secondary" disabled={!phone || busy === 'sms'} onClick={() => send('sms')}>
            <MessageSquare className="w-4 h-4 mr-1" /> {busy === 'sms' ? 'Sende…' : 'SMS senden'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> Automatische Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>Täglich um 07:00 UTC prüft Alix automatisch:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>App fehlt &gt; 3 Tage → Email-Erinnerung</li>
            <li>NiSV fehlt &gt; 7 Tage → Email-Erinnerung</li>
            <li>Schulung fehlt &gt; 14 Tage → Email-Vorschlag</li>
            <li>Mediapaket offen &gt; 14 Tage → Email an Kunden</li>
            <li>Rückruf überfällig → Eskalation (Ampel rot, Priorität dringend)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

interface AiResult {
  health_score: number;
  risk_level: 'low' | 'medium' | 'high';
  recommended_next_contact_at: string;
  recommended_next_contact_days: number;
  summary: string;
  next_actions: string[];
  upsell_suggestions: Array<{ product_key: string; label: string }>;
  email_draft: string;
  sms_draft: string;
}

function AiSuggestPanel({ caseId, healthScore }: { caseId: string; healthScore: number | null }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);

  async function analyze() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('as-ai-suggest', { body: { case_id: caseId } });
      if (error || (data as any)?.error) throw new Error(error?.message ?? (data as any)?.error);
      setResult(data as AiResult);
      toast.success('KI-Analyse erstellt');
    } catch (e: any) {
      toast.error(e?.message ?? 'KI-Analyse fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} kopiert`); }
    catch { toast.error('Kopieren fehlgeschlagen'); }
  }

  const riskColor = result?.risk_level === 'high' ? 'bg-rose-500'
    : result?.risk_level === 'medium' ? 'bg-amber-400' : 'bg-emerald-500';
  const healthColor = (h: number) => h >= 75 ? 'text-emerald-500' : h >= 50 ? 'text-amber-500' : 'text-rose-500';

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> KI-Analyse (Lovable AI · Gemini)
          </CardTitle>
          <div className="flex items-center gap-3">
            {healthScore != null && (
              <span className="text-xs text-muted-foreground">
                Letzter Score: <span className={`font-semibold ${healthColor(healthScore)}`}>{healthScore}/100</span>
              </span>
            )}
            <Button size="sm" onClick={analyze} disabled={busy}>
              <Sparkles className="w-4 h-4 mr-1" /> {busy ? 'Analysiere…' : 'Analyse starten'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!result && !busy && (
            <p className="text-sm text-muted-foreground">
              Die KI analysiert Checkliste, Timeline, Rückrufe und Mediapaket-Status und liefert Health-Score, Risiko-Einschätzung,
              empfohlene Maßnahmen, Upselling-Vorschläge sowie fertige Email- und SMS-Entwürfe.
            </p>
          )}
          {result && (
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Health Score</div>
                <div className={`text-3xl font-bold ${healthColor(result.health_score)}`}>{result.health_score}<span className="text-base text-muted-foreground">/100</span></div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Risiko</div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${riskColor}`} />
                  <span className="font-semibold uppercase">{result.risk_level}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Nächster Kontakt empfohlen</div>
                <div className="font-semibold">in {result.recommended_next_contact_days} Tagen</div>
                <div className="text-xs text-muted-foreground">{new Date(result.recommended_next_contact_at).toLocaleDateString('de-DE')}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-sm">Zusammenfassung</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line">{result.summary || '—'}</p>
            </CardContent>
          </Card>

          {result.next_actions.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Empfohlene Maßnahmen</CardTitle></CardHeader>
              <CardContent>
                <ol className="list-decimal pl-5 text-sm space-y-1">
                  {result.next_actions.map((a, i) => <li key={i}>{a}</li>)}
                </ol>
              </CardContent>
            </Card>
          )}

          {result.upsell_suggestions.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Upselling-Vorschläge</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {result.upsell_suggestions.map((u, i) => (
                    <li key={i} className="flex justify-between border-b py-1">
                      <span>{u.label}</span>
                      <Badge variant="outline">{u.product_key}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Email-Entwurf</CardTitle>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.email_draft, 'Email')}>Kopieren</Button>
              </CardHeader>
              <CardContent>
                <Textarea value={result.email_draft} onChange={(e) => setResult({ ...result, email_draft: e.target.value })} rows={10} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> SMS-Entwurf</CardTitle>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(result.sms_draft, 'SMS')}>Kopieren</Button>
              </CardHeader>
              <CardContent>
                <Textarea value={result.sms_draft} onChange={(e) => setResult({ ...result, sms_draft: e.target.value })} rows={5} maxLength={480} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
