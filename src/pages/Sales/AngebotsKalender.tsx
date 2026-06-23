import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  CalendarClock, AlertTriangle, CalendarDays, TrendingUp, RefreshCw,
  Mail, MessageSquare, Phone, FileText, User, CheckCircle2, XCircle, Pencil, ExternalLink, Trophy, CalendarPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { useAuth } from '@/hooks/useAuth';

type Task = {
  id: string;
  offer_number: string;
  customer_id: string | null;
  owner_user_id: string | null;
  stage: number;
  due_at: string;
  status: string;
  priority: 'gruen' | 'gelb' | 'orange' | 'rot';
  title: string;
  channel_done: string | null;
  done_at: string | null;
};

type Outcome = { offer_number: string; outcome: 'offen' | 'gewonnen' | 'verloren' | 'inaktiv' };

type OfferLite = {
  offer_number: string;
  customer_name: string | null;
  customer_email: string | null;
  total_gross: number | null;
  created_by_name: string | null;
  status: string;
};

const PRIO: Record<Task['priority'], { label: string; cls: string; dot: string }> = {
  rot: { label: 'Überfällig', cls: 'bg-red-500/10 text-red-400 border-red-500/30', dot: 'bg-red-500' },
  orange: { label: 'Dringend', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/30', dot: 'bg-orange-500' },
  gelb: { label: 'Nachfassen', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  gruen: { label: 'Neu', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
};

const fmtMoney = (n: number) => (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const fmtDate = (s: string) => new Date(s).toLocaleDateString('de-DE');

export default function AngebotsKalender() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Super Admin') || hasRole('Admin');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [outcomes, setOutcomes] = useState<Map<string, Outcome['outcome']>>(new Map());
  const [offers, setOffers] = useState<Map<string, OfferLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [running, setRunning] = useState(false);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactTask, setContactTask] = useState<Task | null>(null);
  const [contactChannel, setContactChannel] = useState<'email' | 'sms' | 'call' | 'note'>('note');
  const [contactSubject, setContactSubject] = useState('');
  const [contactBody, setContactBody] = useState('');
  const [contactBusy, setContactBusy] = useState(false);

  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcomeOfferNr, setOutcomeOfferNr] = useState<string | null>(null);
  const [outcomeReason, setOutcomeReason] = useState('');
  const [outcomeBusy, setOutcomeBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [t, oc, of] = await Promise.all([
      supabase.from('offer_followup_tasks').select('*').eq('status', 'offen')
        .order('due_at', { ascending: true }).limit(2000),
      supabase.from('offer_outcomes').select('offer_number, outcome').limit(5000),
      supabase.from('offers').select('offer_number, customer_name, customer_email, total_gross, created_by_name, status').limit(2000),
    ]);
    setTasks((t.data ?? []) as Task[]);
    setOutcomes(new Map((oc.data ?? []).map((x: any) => [x.offer_number, x.outcome])));
    setOffers(new Map((of.data ?? []).map((x: any) => [x.offer_number, x])));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('offer-followup-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offer_followup_tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offer_outcomes' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return tasks.filter((t) => {
      if (outcomes.get(t.offer_number) === 'gewonnen' || outcomes.get(t.offer_number) === 'verloren') return false;
      if (!q) return true;
      const o = offers.get(t.offer_number);
      return [
        t.offer_number, t.title, o?.customer_name, o?.customer_email, o?.created_by_name,
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [tasks, outcomes, offers, filter]);

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(now); endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const groups = useMemo(() => {
    const heute: Task[] = [], ueberfaellig: Task[] = [], woche: Task[] = [], monat: Task[] = [];
    for (const t of visible) {
      const due = new Date(t.due_at).getTime();
      if (due < startOfToday.getTime()) ueberfaellig.push(t);
      else if (due <= endOfToday.getTime()) heute.push(t);
      if (due <= endOfWeek.getTime()) woche.push(t);
      if (due <= endOfMonth.getTime()) monat.push(t);
    }
    return { heute, ueberfaellig, woche, monat };
  }, [visible]);

  // Erfolgsquote
  const successRate = useMemo(() => {
    let won = 0, lost = 0, open = 0;
    for (const [, oc] of outcomes) {
      if (oc === 'gewonnen') won++;
      else if (oc === 'verloren') lost++;
      else open++;
    }
    const decided = won + lost;
    return { won, lost, open, quote: decided > 0 ? Math.round((won / decided) * 100) : 0 };
  }, [outcomes]);

  async function runEngine() {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke('offer-followup-engine', { body: {} });
      if (error) throw error;
      toast.success('Nachfass-Engine ausgeführt.');
      await load();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'unbekannt'));
    } finally {
      setRunning(false);
    }
  }

  function openContact(t: Task, channel: 'email' | 'sms' | 'call' | 'note') {
    setContactTask(t);
    setContactChannel(channel);
    setContactSubject('');
    setContactBody('');
    setContactOpen(true);
  }

  async function submitContact() {
    if (!contactTask) return;
    setContactBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      await supabase.from('offer_contact_log').insert({
        offer_number: contactTask.offer_number,
        customer_id: contactTask.customer_id,
        user_id: userRes.user?.id || null,
        channel: contactChannel,
        subject: contactSubject || null,
        body: contactBody || null,
      });
      await supabase.from('offer_followup_tasks').update({
        status: 'erledigt',
        channel_done: contactChannel,
        done_at: new Date().toISOString(),
      }).eq('id', contactTask.id);
      toast.success('Kontakt dokumentiert.');
      setContactOpen(false);
      await load();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'unbekannt'));
    } finally {
      setContactBusy(false);
    }
  }

  function openOutcome(offer_number: string) {
    setOutcomeOfferNr(offer_number);
    setOutcomeReason('');
    setOutcomeOpen(true);
  }

  async function submitOutcome(decision: 'gewonnen' | 'verloren') {
    if (!outcomeOfferNr) return;
    setOutcomeBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      await supabase.from('offer_outcomes').upsert({
        offer_number: outcomeOfferNr,
        outcome: decision,
        reason: outcomeReason || null,
        decided_by: userRes.user?.id || null,
        decided_at: new Date().toISOString(),
      }, { onConflict: 'offer_number' });
      toast.success(decision === 'gewonnen' ? 'Angebot gewonnen.' : 'Angebot verloren.');
      setOutcomeOpen(false);
      await load();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'unbekannt'));
    } finally {
      setOutcomeBusy(false);
    }
  }

  function renderTask(t: Task) {
    const o = offers.get(t.offer_number);
    const prio = PRIO[t.priority];
    return (
      <Card key={t.id} className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2.5 w-2.5 rounded-full ${prio.dot}`} />
                <Badge variant="outline" className={prio.cls}>{prio.label}</Badge>
                <Badge variant="secondary">Stufe {t.stage}</Badge>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />{fmtDate(t.due_at)}
                </span>
              </div>
              <div className="font-semibold">
                {t.offer_number} · {o?.customer_name || '—'}
              </div>
              <div className="text-sm text-muted-foreground">
                {t.title}
                {o?.created_by_name ? ` · Vertrieb: ${o.created_by_name}` : ''}
                {typeof o?.total_gross === 'number' ? ` · ${fmtMoney(o.total_gross)}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => openContact(t, 'email')} title="E-Mail dokumentieren">
                <Mail className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => openContact(t, 'sms')} title="SMS dokumentieren">
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => openContact(t, 'call')} title="Anruf dokumentieren">
                <Phone className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => openContact(t, 'note')} title="Notiz">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" asChild title="Angebot öffnen">
                <Link to={`/verkauf/angebot/neu?edit=${encodeURIComponent(t.offer_number)}`}>
                  <FileText className="h-4 w-4" />
                </Link>
              </Button>
              {t.customer_id && (
                <Button size="sm" variant="outline" asChild title="Kundenakte">
                  <Link to={`/kunden/${t.customer_id}`}><User className="h-4 w-4" /></Link>
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-emerald-500 border-emerald-500/30"
                onClick={() => openOutcome(t.offer_number)} title="Gewonnen / Verloren">
                <Trophy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderList(list: Task[]) {
    if (loading) return <div className="p-6 text-muted-foreground">Lade…</div>;
    if (list.length === 0) return <div className="p-6 text-muted-foreground">Keine Einträge.</div>;
    return <div className="p-4 space-y-3">{list.map(renderTask)}</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={CalendarDays}
        title="Angebotskalender & Follow-Up 360°"
        subtitle="Kein Angebot vergessen — automatische Nachfasskette, Kundenkontakte und Erfolgsquote."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/verkauf/angebote"><ExternalLink className="h-4 w-4 mr-2" />Angebote</Link>
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={runEngine} disabled={running}>
                <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />Engine starten
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiTile label="Heute fällig" value={groups.heute.length} icon={CalendarClock} accent="sky" />
        <KpiTile label="Überfällig" value={groups.ueberfaellig.length} icon={AlertTriangle} accent={groups.ueberfaellig.length ? 'rose' : 'gold'} />
        <KpiTile label="Diese Woche" value={groups.woche.length} icon={CalendarDays} accent="gold" />
        <KpiTile label="Diesen Monat" value={groups.monat.length} icon={CalendarDays} accent="violet" />
        <KpiTile label="Erfolgsquote" value={`${successRate.quote}%`} icon={TrendingUp} accent="emerald" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Nachfass-Aufgaben</CardTitle>
            <Input placeholder="Suche Angebot, Kunde, Vertrieb…" value={filter}
              onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="heute">
            <TabsList className="m-3">
              <TabsTrigger value="heute">Heute ({groups.heute.length})</TabsTrigger>
              <TabsTrigger value="ueberfaellig">Überfällig ({groups.ueberfaellig.length})</TabsTrigger>
              <TabsTrigger value="woche">Diese Woche ({groups.woche.length})</TabsTrigger>
              <TabsTrigger value="monat">Monat ({groups.monat.length})</TabsTrigger>
              <TabsTrigger value="cockpit">Cockpit</TabsTrigger>
            </TabsList>
            <TabsContent value="heute">{renderList(groups.heute)}</TabsContent>
            <TabsContent value="ueberfaellig">{renderList(groups.ueberfaellig)}</TabsContent>
            <TabsContent value="woche">{renderList(groups.woche)}</TabsContent>
            <TabsContent value="monat">{renderList(groups.monat)}</TabsContent>
            <TabsContent value="cockpit">
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <KpiTile label="Gewonnen" value={successRate.won} icon={CheckCircle2} accent="emerald" />
                <KpiTile label="Verloren" value={successRate.lost} icon={XCircle} accent="rose" />
                <KpiTile label="Offen" value={successRate.open} icon={CalendarClock} accent="gold" />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Kontakt-Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {contactChannel === 'email' && 'E-Mail dokumentieren'}
              {contactChannel === 'sms' && 'SMS dokumentieren'}
              {contactChannel === 'call' && 'Anruf dokumentieren'}
              {contactChannel === 'note' && 'Notiz hinzufügen'}
            </DialogTitle>
            <DialogDescription>
              {contactTask ? `${contactTask.offer_number} · Stufe ${contactTask.stage}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(contactChannel === 'email' || contactChannel === 'note') && (
              <Input placeholder="Betreff" value={contactSubject} onChange={(e) => setContactSubject(e.target.value)} />
            )}
            <Textarea rows={5} placeholder="Inhalt / Notiz" value={contactBody}
              onChange={(e) => setContactBody(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContactOpen(false)} disabled={contactBusy}>Abbrechen</Button>
            <Button onClick={submitContact} disabled={contactBusy}>Speichern & Aufgabe erledigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome-Dialog */}
      <Dialog open={outcomeOpen} onOpenChange={setOutcomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ergebnis erfassen</DialogTitle>
            <DialogDescription>
              {outcomeOfferNr ? `Angebot ${outcomeOfferNr}` : ''}
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={3} placeholder="Begründung (optional)" value={outcomeReason}
            onChange={(e) => setOutcomeReason(e.target.value)} />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-destructive/40 text-destructive"
              onClick={() => submitOutcome('verloren')} disabled={outcomeBusy}>
              <XCircle className="h-4 w-4 mr-2" />Verloren
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={() => submitOutcome('gewonnen')} disabled={outcomeBusy}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Gewonnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
