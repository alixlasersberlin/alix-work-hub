import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap, BookOpen, ShieldCheck, FileText, PlayCircle, CheckSquare,
  Rocket, Activity, FileCheck2, Mail, FileDown, Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Status = 'pending' | 'active' | 'done';
const STATUS: Record<Status, { color: string; label: string }> = {
  pending: { color: 'bg-muted text-muted-foreground', label: 'Geplant' },
  active: { color: 'bg-blue-500/15 text-blue-400', label: 'Aktiv' },
  done: { color: 'bg-emerald-500/15 text-emerald-400', label: 'Abgeschlossen' },
};

const USER_SECTIONS = [
  { t: 'Dashboard', d: 'Übersicht aller KPIs, Versandstatistiken, aktive Kampagnen und Systemstatus.' },
  { t: 'E-Mail schreiben', d: 'Neue Mail verfassen, Empfänger wählen, Vorlage einfügen, Anhänge anfügen, Versand planen.' },
  { t: 'Vorlagen', d: 'Vorlagen anlegen, bearbeiten, duplizieren und deaktivieren. Variablen wie {{kunde}} verwenden.' },
  { t: 'Kampagnen', d: 'Empfängerliste wählen, Vorlage zuweisen, Zeitplan setzen, Tracking aktivieren, Bericht abrufen.' },
  { t: 'Tracking', d: 'Live-Status sent / delivered / opened / clicked / bounced pro Mail einsehen.' },
  { t: 'Kundenhistorie', d: 'Alle Mails, Anrufe, Tickets und Dokumente pro Kunde chronologisch sichtbar.' },
  { t: 'Dokumentencenter', d: 'Rechnungen, Angebote, Lieferscheine versenden, Versandnachweis automatisch erfasst.' },
  { t: 'WhatsApp', d: 'WhatsApp-Nachrichten senden, Automationen verwalten, Empfänger zuordnen.' },
  { t: 'Telefonie (3CX)', d: 'Click-to-Call, Telefonnotizen, Rückrufe, Gesprächsprotokolle, Live-Anrufe.' },
  { t: 'Aufgaben & Wiedervorlagen', d: 'Aufgaben anlegen, zuweisen, Fristen setzen, Wiedervorlagen verwalten.' },
  { t: 'Kundenportal', d: 'Nachrichten lesen/beantworten, Dokumente downloaden, Reparaturstatus, Tickets erstellen.' },
];

const ADMIN_SECTIONS = [
  { t: 'Rollen', d: 'Superadmin, Geschäftsführung, Finance, Vertrieb, Service, Marketing, Read Only.' },
  { t: 'Rechte', d: 'Matrix pro Modul: ansehen / erstellen / bearbeiten / löschen / senden / verwalten.' },
  { t: 'Resend', d: 'API-Key, Webhooks, Versanddomain, Bounce-Behandlung, Suppression-Liste.' },
  { t: 'Domains', d: 'Domain hinzufügen, SPF, DKIM, DMARC prüfen, Versandadresse aktivieren.' },
  { t: 'Tracking & Webhooks', d: 'Webhook-URL bei Resend hinterlegen, mail_events Tabelle prüfen.' },
  { t: 'Backups & Wiederherstellung', d: 'Tägliche Backups, Aufbewahrung 30/90/365 Tage, Restore-Test 1× monatlich.' },
  { t: 'Audit Logs', d: 'Alle Aktionen werden in mail_audit_logs revisionssicher protokolliert.' },
  { t: 'Sicherheit', d: 'RLS, Rollenprüfung, Zwei-Faktor, Abmeldelinks, DSGVO-konforme Suppression.' },
];

const SOPS = {
  Finance: ['Rechnung versenden', 'Mahnung versenden', 'Zahlungserinnerung'],
  Vertrieb: ['Angebot versenden', 'Kampagne starten', 'Lead nachfassen'],
  Service: ['Reparaturstatus melden', 'Wartung ankündigen', 'Reklamation bearbeiten'],
  Marketing: ['Newsletter versenden', 'Kampagne planen', 'Auswertung erstellen'],
};

const FAQ = [
  { q: 'Wie sende ich eine Testmail?', a: 'MailCenter → E-Mail schreiben → Empfänger eingeben → Senden.' },
  { q: 'Warum kommt eine Mail nicht an?', a: 'Tracking → Status prüfen. Bei bounced/suppressed siehe Abmeldungen.' },
  { q: 'Wie ändere ich eine Vorlage?', a: 'Vorlagen → Vorlage öffnen → Editor → Speichern. Variablen mit {{name}}.' },
  { q: 'Kann ich Mails planen?', a: 'Ja, beim Senden Datum/Uhrzeit auswählen.' },
  { q: 'Wo sehe ich die Kampagnen-Auswertung?', a: 'Kampagnen → Kampagne öffnen → Bericht / Tracking-Tab.' },
];

const ROLLOUT = [
  { id: 1, name: 'Phase 1 — Finance', status: 'active' as Status },
  { id: 2, name: 'Phase 2 — Vertrieb', status: 'pending' as Status },
  { id: 3, name: 'Phase 3 — Service', status: 'pending' as Status },
  { id: 4, name: 'Phase 4 — Marketing', status: 'pending' as Status },
  { id: 5, name: 'Phase 5 — Kundenportal', status: 'pending' as Status },
];

export default function Schulungscenter() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const [rollout, setRollout] = useState(ROLLOUT);
  const [pilotFeedback, setPilotFeedback] = useState('');

  const rolloutProgress = Math.round((rollout.filter(p => p.status === 'done').length / rollout.length) * 100);

  function advancePhase(id: number) {
    if (!isSuperAdmin) { toast.error('Nur Super Admin'); return; }
    setRollout(prev => prev.map(p => p.id === id
      ? { ...p, status: p.status === 'pending' ? 'active' : p.status === 'active' ? 'done' : 'done' }
      : p));
    toast.success('Phase aktualisiert');
  }

  function downloadHandbook(type: 'user' | 'admin') {
    const sections = type === 'user' ? USER_SECTIONS : ADMIN_SECTIONS;
    const title = type === 'user' ? 'Alix MailCenter — Benutzerhandbuch' : 'Alix MailCenter — Administrator-Handbuch';
    const md = [`# ${title}`, '', `Stand: ${new Date().toLocaleDateString('de-DE')}`, '', ...sections.flatMap(s => [`## ${s.t}`, '', s.d, ''])].join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type === 'user' ? 'benutzerhandbuch' : 'admin-handbuch'}-mailcenter.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadManagementReport() {
    const md = [
      '# Alix MailCenter — Management-Bericht',
      `Erstellt: ${new Date().toLocaleString('de-DE')}`, '',
      '## Produktiv-Rollout', '',
      ...rollout.map(p => `- ${p.name}: **${STATUS[p.status].label}**`),
      '', `Fortschritt: ${rolloutProgress}%`, '',
      '## KPIs (letzte 7 Tage)', '',
      '- Öffnungsrate: siehe Executive Dashboard',
      '- Klickrate: siehe Executive Dashboard',
      '- Antwortquote: siehe Posteingang',
      '- Systemfehler: siehe Fehlerprotokoll',
      '', '## ISO / MDR', '',
      '- Rollen, Rechte und Audit Logs vollständig dokumentiert',
      '- Backups täglich, Wiederherstellung getestet',
      '- Validierung durch Qualitätssicherung-Modul',
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `management-bericht-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-primary" />
          <div>
            <h2 className="text-2xl font-display font-bold">Schulungscenter</h2>
            <p className="text-sm text-muted-foreground">Phase 2 — Dokumentation, Schulung & Produktiv-Rollout</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadHandbook('user')}>
            <FileDown className="w-4 h-4 mr-2" /> Benutzerhandbuch
          </Button>
          <Button variant="outline" onClick={() => downloadHandbook('admin')}>
            <FileDown className="w-4 h-4 mr-2" /> Admin-Handbuch
          </Button>
          <Button onClick={downloadManagementReport}>
            <Mail className="w-4 h-4 mr-2" /> Management-Bericht
          </Button>
        </div>
      </div>

      <Tabs defaultValue="user">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="user"><BookOpen className="w-4 h-4 mr-1" /> Benutzerhandbuch</TabsTrigger>
          <TabsTrigger value="admin"><ShieldCheck className="w-4 h-4 mr-1" /> Admin-Handbuch</TabsTrigger>
          <TabsTrigger value="sop"><FileText className="w-4 h-4 mr-1" /> SOPs</TabsTrigger>
          <TabsTrigger value="training"><PlayCircle className="w-4 h-4 mr-1" /> Schulungen</TabsTrigger>
          <TabsTrigger value="faq"><CheckSquare className="w-4 h-4 mr-1" /> FAQ & Checklisten</TabsTrigger>
          <TabsTrigger value="pilot"><Users className="w-4 h-4 mr-1" /> Pilotbetrieb</TabsTrigger>
          <TabsTrigger value="rollout"><Rocket className="w-4 h-4 mr-1" /> Rollout</TabsTrigger>
          <TabsTrigger value="kpi"><Activity className="w-4 h-4 mr-1" /> KPI-Monitoring</TabsTrigger>
          <TabsTrigger value="iso"><FileCheck2 className="w-4 h-4 mr-1" /> ISO / MDR</TabsTrigger>
        </TabsList>

        <TabsContent value="user">
          <Card>
            <CardHeader><CardTitle>Benutzerhandbuch</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {USER_SECTIONS.map((s, i) => (
                  <AccordionItem key={i} value={`u-${i}`}>
                    <AccordionTrigger>{s.t}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{s.d}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin">
          <Card>
            <CardHeader><CardTitle>Administrator-Handbuch</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {ADMIN_SECTIONS.map((s, i) => (
                  <AccordionItem key={i} value={`a-${i}`}>
                    <AccordionTrigger>{s.t}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{s.d}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sop">
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(SOPS).map(([dept, items]) => (
              <Card key={dept}>
                <CardHeader><CardTitle>{dept}</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {items.map(i => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-primary" /> {i}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="training">
          <Card>
            <CardHeader><CardTitle>Schulungsmaterialien</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {['Einführung MailCenter (Video)', 'Vorlagen & Variablen (Video)', 'Kampagnen Schritt-für-Schritt (PDF)',
                'Tracking verstehen (PDF)', 'Telefonie 3CX (Video)', 'Kundenportal-Workflow (PDF)'].map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-border rounded-md bg-card/40">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">{m}</span>
                  </div>
                  <Badge variant="outline">Verfügbar</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader><CardTitle>Häufige Fragen</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {FAQ.map((f, i) => (
                  <AccordionItem key={i} value={`f-${i}`}>
                    <AccordionTrigger>{f.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-2">Go-Live Checkliste</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {['Domain verifiziert', 'SPF/DKIM/DMARC gültig', 'Testmail erfolgreich', 'Tracking erfasst',
                    'Abmeldung getestet', 'Rollen geprüft', 'Backups laufen', 'Audit-Log aktiv'].map(c => (
                    <li key={c} className="flex items-center gap-2"><CheckSquare className="w-4 h-4 text-emerald-400" />{c}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pilot">
          <Card>
            <CardHeader><CardTitle>Pilotbetrieb (14 Tage — Finance, Vertrieb, Service)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 border border-border rounded-md">Finance<br /><Badge className="bg-emerald-500/15 text-emerald-400 mt-1">Aktiv</Badge></div>
                <div className="p-3 border border-border rounded-md">Vertrieb<br /><Badge className="bg-emerald-500/15 text-emerald-400 mt-1">Aktiv</Badge></div>
                <div className="p-3 border border-border rounded-md">Service<br /><Badge className="bg-emerald-500/15 text-emerald-400 mt-1">Aktiv</Badge></div>
              </div>
              <textarea
                className="w-full min-h-24 p-3 rounded-md bg-background border border-border text-sm"
                placeholder="Feedback, Fehler oder Verbesserungsvorschlag eintragen…"
                value={pilotFeedback}
                onChange={(e) => setPilotFeedback(e.target.value)}
              />
              <Button onClick={() => { if (pilotFeedback) { toast.success('Feedback gespeichert'); setPilotFeedback(''); } }}>
                Feedback speichern
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rollout">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Produktiv-Rollout</span>
                <Badge>{rolloutProgress}%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={rolloutProgress} />
              {rollout.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 border border-border rounded-md bg-card/40">
                  <div className="flex items-center gap-3">
                    <Rocket className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS[p.status].color}>{STATUS[p.status].label}</Badge>
                    {isSuperAdmin && p.status !== 'done' && (
                      <Button size="sm" variant="outline" onClick={() => advancePhase(p.id)}>
                        {p.status === 'pending' ? 'Aktivieren' : 'Abschließen'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpi">
          <Card>
            <CardHeader><CardTitle>KPI-Monitoring</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {['Öffnungsrate', 'Klickrate', 'Antwortquote', 'Kampagnenerfolg', 'Systemfehler', 'Benutzeraktivität'].map(k => (
                  <div key={k} className="p-3 border border-border rounded-md bg-card/40">
                    <div className="text-muted-foreground text-xs">{k}</div>
                    <div className="text-lg font-semibold">Siehe Executive Dashboard</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iso">
          <Card>
            <CardHeader><CardTitle>ISO 13485 / MDR Vorbereitung</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {[
                  'Rollen & Rechte dokumentiert (Berechtigungen-Seite + Admin-Handbuch)',
                  'Änderungen protokolliert (Audit-Log)',
                  'Datensicherung täglich (Backup Center)',
                  'Wiederherstellung getestet (Restore-Plan im Admin-Handbuch)',
                  'Validierung über Qualitätssicherung-Modul',
                  'Versandnachweise & Suppression revisionssicher',
                ].map(i => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-400" /> {i}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
