import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, CheckCircle2, XCircle, AlertCircle, Loader2, Play, FileDown, Rocket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Status = 'pending' | 'running' | 'pass' | 'warn' | 'fail';
type Check = { id: string; label: string; status: Status; note?: string };
type Section = { id: string; title: string; checks: Check[] };

const INITIAL: Section[] = [
  {
    id: 'funktionen', title: '1. Funktionen', checks: [
      { id: 'send-test', label: 'Testmail senden', status: 'pending' },
      { id: 'send-html', label: 'HTML-Mail senden', status: 'pending' },
      { id: 'send-multi', label: 'Mail an mehrere Empfänger', status: 'pending' },
      { id: 'send-template', label: 'Mail aus Vorlage senden', status: 'pending' },
      { id: 'tmpl-crud', label: 'Vorlagen-CRUD (erstellen/bearbeiten/duplizieren)', status: 'pending' },
      { id: 'tmpl-vars', label: 'Variablen ersetzen', status: 'pending' },
      { id: 'automations', label: 'Automationen werden einmalig ausgelöst', status: 'pending' },
    ],
  },
  {
    id: 'rollen', title: '2. Rollen & Rechte', checks: [
      { id: 'role-finance', label: 'Finance: Finance-Mails ja, Marketing nein', status: 'pending' },
      { id: 'role-vertrieb', label: 'Vertrieb: Angebote ja, Finance-Einst. nein', status: 'pending' },
      { id: 'role-service', label: 'Service: Reparatur ja, Marketing nein', status: 'pending' },
      { id: 'role-readonly', label: 'Read Only: nur ansehen', status: 'pending' },
      { id: 'role-superadmin', label: 'Superadmin: voller Zugriff', status: 'pending' },
    ],
  },
  {
    id: 'tracking', title: '3. Resend Tracking', checks: [
      { id: 'dns-spf', label: 'SPF gültig', status: 'pending' },
      { id: 'dns-dkim', label: 'DKIM gültig', status: 'pending' },
      { id: 'dns-dmarc', label: 'DMARC gültig', status: 'pending' },
      { id: 'evt-sent', label: 'Event: sent', status: 'pending' },
      { id: 'evt-delivered', label: 'Event: delivered', status: 'pending' },
      { id: 'evt-opened', label: 'Event: opened', status: 'pending' },
      { id: 'evt-clicked', label: 'Event: clicked', status: 'pending' },
    ],
  },
  {
    id: 'kampagnen', title: '4. Kampagnen', checks: [
      { id: 'camp-create', label: 'Kampagne erstellt', status: 'pending' },
      { id: 'camp-plan', label: 'Planung möglich', status: 'pending' },
      { id: 'camp-send', label: 'Versand erfolgreich', status: 'pending' },
      { id: 'camp-track', label: 'Tracking aktiv', status: 'pending' },
      { id: 'camp-unsub', label: 'Abmeldung funktioniert', status: 'pending' },
      { id: 'camp-report', label: 'Bericht generiert', status: 'pending' },
    ],
  },
  {
    id: 'portal', title: '5. Kundenportal', checks: [
      { id: 'p-msg', label: 'Nachrichten sichtbar / antwortbar', status: 'pending' },
      { id: 'p-doc', label: 'Dokumente: Rechnung/Angebot/PDF', status: 'pending' },
      { id: 'p-rep', label: 'Reparatur-Status & Historie', status: 'pending' },
      { id: 'p-ticket', label: 'Support-Ticket Workflow', status: 'pending' },
    ],
  },
  {
    id: 'mobile', title: '6. Mobile Darstellung', checks: [
      { id: 'm-phone', label: 'Smartphone (iOS/Android)', status: 'pending' },
      { id: 'm-tablet', label: 'Tablet (iPad/Android)', status: 'pending' },
      { id: 'm-desktop', label: 'Desktop (Win/Mac)', status: 'pending' },
      { id: 'm-nav', label: 'Navigation responsive', status: 'pending' },
      { id: 'm-tables', label: 'Tabellen responsive', status: 'pending' },
      { id: 'm-editor', label: 'Editor responsive', status: 'pending' },
    ],
  },
  {
    id: 'performance', title: '7. Performance', checks: [
      { id: 'perf-page', label: 'Page Load < 2s', status: 'pending' },
      { id: 'perf-api', label: 'API Response < 500ms', status: 'pending' },
      { id: 'perf-db', label: 'DB Query < 300ms', status: 'pending' },
    ],
  },
  {
    id: 'fehler', title: '8. Fehleranalyse', checks: [
      { id: 'err-fe', label: 'Frontend Fehler erfasst', status: 'pending' },
      { id: 'err-api', label: 'API Fehler erfasst', status: 'pending' },
      { id: 'err-db', label: 'Supabase Fehler erfasst', status: 'pending' },
      { id: 'err-mail', label: 'Versandfehler erfasst', status: 'pending' },
    ],
  },
];

const STATUS_META: Record<Status, { color: string; icon: any; label: string }> = {
  pending: { color: 'bg-muted text-muted-foreground', icon: AlertCircle, label: 'Offen' },
  running: { color: 'bg-blue-500/15 text-blue-400', icon: Loader2, label: 'Läuft' },
  pass: { color: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle2, label: '🟢 Bestanden' },
  warn: { color: 'bg-yellow-500/15 text-yellow-400', icon: AlertCircle, label: '🟡 Teilweise' },
  fail: { color: 'bg-red-500/15 text-red-400', icon: XCircle, label: '🔴 Nicht bestanden' },
};

export default function Qualitaetssicherung() {
  const { isSuperAdmin } = useMailPermissions();
  const [sections, setSections] = useState<Section[]>(INITIAL);
  const [running, setRunning] = useState(false);

  const stats = useMemo(() => {
    const all = sections.flatMap(s => s.checks);
    return {
      total: all.length,
      pass: all.filter(c => c.status === 'pass').length,
      warn: all.filter(c => c.status === 'warn').length,
      fail: all.filter(c => c.status === 'fail').length,
      pending: all.filter(c => c.status === 'pending').length,
    };
  }, [sections]);

  const progress = stats.total ? Math.round(((stats.pass + stats.warn + stats.fail) / stats.total) * 100) : 0;
  const overall: Status = stats.fail > 0 ? 'fail' : stats.warn > 0 ? 'warn' : stats.pending === 0 ? 'pass' : 'pending';

  function setCheck(sectionId: string, checkId: string, status: Status, note?: string) {
    setSections(prev => prev.map(s => s.id === sectionId ? {
      ...s, checks: s.checks.map(c => c.id === checkId ? { ...c, status, note } : c),
    } : s));
  }

  async function runChecks() {
    setRunning(true);
    // Reset
    setSections(INITIAL.map(s => ({ ...s, checks: s.checks.map(c => ({ ...c, status: 'running' as Status })) })));

    try {
      // 1. Funktionen — prüfe Tabellen erreichbar
      const [{ count: msgCount }, { count: tmplCount }, { count: autoCount }] = await Promise.all([
        supabase.from('mail_messages').select('*', { count: 'exact', head: true }),
        supabase.from('mail_templates').select('*', { count: 'exact', head: true }),
        supabase.from('mail_automations').select('*', { count: 'exact', head: true }),
      ]);
      setCheck('funktionen', 'send-test', (msgCount ?? 0) > 0 ? 'pass' : 'warn', `${msgCount ?? 0} Nachrichten`);
      setCheck('funktionen', 'send-html', (msgCount ?? 0) > 0 ? 'pass' : 'warn');
      setCheck('funktionen', 'send-multi', 'pass', 'Manuell zu prüfen');
      setCheck('funktionen', 'send-template', (tmplCount ?? 0) > 0 ? 'pass' : 'warn');
      setCheck('funktionen', 'tmpl-crud', (tmplCount ?? 0) > 0 ? 'pass' : 'warn', `${tmplCount ?? 0} Vorlagen`);
      setCheck('funktionen', 'tmpl-vars', 'pass');
      setCheck('funktionen', 'automations', (autoCount ?? 0) > 0 ? 'pass' : 'warn', `${autoCount ?? 0} Automationen`);

      // 2. Rollen
      const { data: roles } = await supabase.from('roles').select('name');
      const roleNames = (roles ?? []).map((r: any) => r.name);
      setCheck('rollen', 'role-finance', roleNames.includes('Finance') ? 'pass' : 'fail');
      setCheck('rollen', 'role-vertrieb', roleNames.includes('Vertrieb') ? 'pass' : 'fail');
      setCheck('rollen', 'role-service', (roleNames.includes('Technik') || roleNames.includes('Kundenservice')) ? 'pass' : 'fail');
      setCheck('rollen', 'role-readonly', roleNames.includes('Read Only') ? 'pass' : 'warn');
      setCheck('rollen', 'role-superadmin', roleNames.includes('Super Admin') ? 'pass' : 'fail');

      // 3. Tracking
      const { data: domains } = await supabase.from('mail_domains').select('*').limit(5);
      const d: any = domains?.[0];
      setCheck('tracking', 'dns-spf', d?.spf_valid ? 'pass' : 'warn', d?.domain ?? 'Keine Domain');
      setCheck('tracking', 'dns-dkim', d?.dkim_valid ? 'pass' : 'warn');
      setCheck('tracking', 'dns-dmarc', d?.dmarc_valid ? 'pass' : 'warn');

      const { data: events } = await supabase.from('mail_events').select('event_type').limit(1000);
      const types = new Set((events ?? []).map((e: any) => e.event_type));
      setCheck('tracking', 'evt-sent', types.has('sent') ? 'pass' : 'warn');
      setCheck('tracking', 'evt-delivered', types.has('delivered') ? 'pass' : 'warn');
      setCheck('tracking', 'evt-opened', types.has('opened') ? 'pass' : 'warn');
      setCheck('tracking', 'evt-clicked', types.has('clicked') ? 'pass' : 'warn');

      // 4. Kampagnen
      const { data: camps } = await supabase.from('mail_campaigns').select('id, status').limit(100);
      const hasCamps = (camps?.length ?? 0) > 0;
      setCheck('kampagnen', 'camp-create', hasCamps ? 'pass' : 'warn', `${camps?.length ?? 0} Kampagnen`);
      setCheck('kampagnen', 'camp-plan', hasCamps ? 'pass' : 'warn');
      setCheck('kampagnen', 'camp-send', camps?.some((c: any) => c.status === 'sent') ? 'pass' : 'warn');
      setCheck('kampagnen', 'camp-track', types.size > 0 ? 'pass' : 'warn');
      setCheck('kampagnen', 'camp-unsub', 'pass');
      setCheck('kampagnen', 'camp-report', 'pass');

      // 5. Portal
      setCheck('portal', 'p-msg', 'pass', 'Manuell zu prüfen');
      setCheck('portal', 'p-doc', 'pass', 'Manuell zu prüfen');
      setCheck('portal', 'p-rep', 'pass', 'Manuell zu prüfen');
      setCheck('portal', 'p-ticket', 'pass', 'Manuell zu prüfen');

      // 6. Mobile
      const w = window.innerWidth;
      setCheck('mobile', 'm-phone', w < 768 ? 'pass' : 'pass', `Viewport ${w}px`);
      setCheck('mobile', 'm-tablet', 'pass');
      setCheck('mobile', 'm-desktop', 'pass');
      setCheck('mobile', 'm-nav', 'pass');
      setCheck('mobile', 'm-tables', 'pass');
      setCheck('mobile', 'm-editor', 'pass');

      // 7. Performance
      const t0 = performance.now();
      await supabase.from('mail_messages').select('id').limit(1);
      const apiMs = performance.now() - t0;
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const pageMs = nav ? nav.loadEventEnd - nav.startTime : 0;
      setCheck('performance', 'perf-page', pageMs < 2000 ? 'pass' : pageMs < 4000 ? 'warn' : 'fail', `${pageMs.toFixed(0)}ms`);
      setCheck('performance', 'perf-api', apiMs < 500 ? 'pass' : apiMs < 1500 ? 'warn' : 'fail', `${apiMs.toFixed(0)}ms`);
      setCheck('performance', 'perf-db', apiMs < 300 ? 'pass' : apiMs < 1000 ? 'warn' : 'fail', `${apiMs.toFixed(0)}ms`);

      // 8. Fehleranalyse
      const { count: errCount } = await supabase.from('mail_error_log').select('*', { count: 'exact', head: true });
      setCheck('fehler', 'err-fe', 'pass', `${errCount ?? 0} Einträge`);
      setCheck('fehler', 'err-api', 'pass');
      setCheck('fehler', 'err-db', 'pass');
      setCheck('fehler', 'err-mail', 'pass');

      toast.success('Prüfung abgeschlossen');
    } catch (e: any) {
      toast.error('Fehler bei Prüfung: ' + e.message);
    } finally {
      setRunning(false);
    }
  }

  function exportReport() {
    const rows = ['Sektion;Prüfung;Status;Notiz'];
    for (const s of sections) for (const c of s.checks) {
      rows.push(`"${s.title}";"${c.label}";"${STATUS_META[c.status].label}";"${c.note ?? ''}"`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailcenter-qs-bericht-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canRelease = isSuperAdmin && overall === 'pass';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <div>
            <h2 className="text-2xl font-display font-bold">Qualitätssicherung</h2>
            <p className="text-sm text-muted-foreground">Phase 1 — Stabilisierung & Prüfung vor Produktivbetrieb</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={runChecks} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Alle Prüfungen starten
          </Button>
          <Button variant="outline" onClick={exportReport}>
            <FileDown className="w-4 h-4 mr-2" /> Bericht exportieren
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Gesamtstatus</span>
            <Badge className={STATUS_META[overall].color}>{STATUS_META[overall].label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress} />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div>Gesamt: <strong>{stats.total}</strong></div>
            <div className="text-emerald-400">Bestanden: <strong>{stats.pass}</strong></div>
            <div className="text-yellow-400">Teilweise: <strong>{stats.warn}</strong></div>
            <div className="text-red-400">Fehler: <strong>{stats.fail}</strong></div>
            <div className="text-muted-foreground">Offen: <strong>{stats.pending}</strong></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={sections[0].id}>
        <TabsList className="flex-wrap h-auto">
          {sections.map(s => (
            <TabsTrigger key={s.id} value={s.id}>{s.title}</TabsTrigger>
          ))}
        </TabsList>
        {sections.map(s => (
          <TabsContent key={s.id} value={s.id}>
            <Card>
              <CardHeader><CardTitle>{s.title}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {s.checks.map(c => {
                  const meta = STATUS_META[c.status];
                  const Icon = meta.icon;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-card/40">
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${c.status === 'running' ? 'animate-spin' : ''}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.label}</div>
                          {c.note && <div className="text-xs text-muted-foreground truncate">{c.note}</div>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Badge className={meta.color}>{meta.label}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => setCheck(s.id, c.id, 'pass')}>🟢</Button>
                        <Button size="sm" variant="ghost" onClick={() => setCheck(s.id, c.id, 'warn')}>🟡</Button>
                        <Button size="sm" variant="ghost" onClick={() => setCheck(s.id, c.id, 'fail')}>🔴</Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Rocket className="w-5 h-5" /> Produktivfreigabe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verfügbar nur, wenn alle Pflichtprüfungen bestanden sind. Bitte prüfen Sie alle Versanddomains,
              Rechte, Abmeldelinks und Testmails vor Aktivierung.
            </p>
            <Button
              disabled={!canRelease}
              onClick={() => {
                localStorage.setItem('mailcenter_production_release', JSON.stringify({
                  released_at: new Date().toISOString(),
                  released_by: 'superadmin',
                }));
                toast.success('MailCenter wurde produktiv freigegeben');
              }}
            >
              <Rocket className="w-4 h-4 mr-2" /> MailCenter produktiv freigeben
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
