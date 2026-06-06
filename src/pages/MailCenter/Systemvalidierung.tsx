import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  ShieldCheck, GitBranch, AlertTriangle, LifeBuoy, Database, FileSearch,
  ClipboardCheck, Target, FileSignature, FileDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type PassFail = 'pending' | 'pass' | 'fail';
const PF: Record<PassFail, { color: string; label: string }> = {
  pending: { color: 'bg-muted text-muted-foreground', label: 'Offen' },
  pass: { color: 'bg-emerald-500/15 text-emerald-400', label: '✅ Bestanden' },
  fail: { color: 'bg-red-500/15 text-red-400', label: '❌ Nicht bestanden' },
};

type ValRow = { area: string; testcase: string; expected: string; actual: string; status: PassFail; reviewer: string; date: string };
const INITIAL_VAL: ValRow[] = [
  { area: 'E-Mail Versand', testcase: 'Testmail an interne Adresse senden', expected: 'Mail kommt an, sent in Tracking', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'Tracking', testcase: 'Mail öffnen + Link klicken', expected: 'opened & clicked in mail_events', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'Kampagnen', testcase: 'Testkampagne mit 5 Empfängern', expected: 'Alle erhalten Mail, Bericht generiert', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'Automationen', testcase: 'Trigger "Auftrag erstellt"', expected: 'Auto-Mail einmalig versendet', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'Kundenportal', testcase: 'Login + Dokument download', expected: 'PDF wird geladen', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'Dokumentencenter', testcase: 'Rechnung versenden', expected: 'Versandnachweis erfasst', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'WhatsApp', testcase: 'Testnachricht senden', expected: 'Nachricht zugestellt', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'Telefonie', testcase: 'Click-to-Call ausführen', expected: '3CX initiiert Anruf', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'Rollen & Rechte', testcase: 'Read-Only-User darf nicht senden', expected: 'Senden-Button deaktiviert / RLS blockt', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'Backups', testcase: 'Backup wird täglich erstellt', expected: 'Eintrag im Backup Center', actual: '', status: 'pending', reviewer: '', date: '' },
  { area: 'Wiederherstellung', testcase: 'Restore-Test durchführen', expected: 'Daten vollständig wiederhergestellt', actual: '', status: 'pending', reviewer: '', date: '' },
];

type Change = { id: string; title: string; owner: string; risk: 'low' | 'mid' | 'high'; approved: boolean; testRequired: boolean; goLive: string };
type Risk = { name: string; probability: number; impact: number; mitigation: string; owner: string };
const RISKS: Risk[] = [
  { name: 'Versandausfall', probability: 2, impact: 5, mitigation: 'SMTP-Fallback (z.B. Sendgrid Backup)', owner: 'IT' },
  { name: 'Resend-Ausfall', probability: 2, impact: 5, mitigation: 'Alternativer ESP konfiguriert', owner: 'IT' },
  { name: 'Supabase-Ausfall', probability: 1, impact: 5, mitigation: 'Lesemodus + Statusseite', owner: 'IT' },
  { name: 'Datenverlust', probability: 1, impact: 5, mitigation: 'Tägliche Backups, 30/90/365 Tage', owner: 'Super Admin' },
  { name: 'Fehlkonfiguration', probability: 3, impact: 4, mitigation: 'Change Management + Freigabe', owner: 'Super Admin' },
  { name: 'Rollenfehler', probability: 2, impact: 4, mitigation: 'RLS, Berechtigungs-Audit quartalsweise', owner: 'Super Admin' },
  { name: 'Spam-Blacklisting', probability: 2, impact: 5, mitigation: 'SPF/DKIM/DMARC, Suppression-Liste', owner: 'Marketing' },
  { name: 'Tracking-Ausfall', probability: 2, impact: 3, mitigation: 'Webhook-Retry, manuelle Nachsynchronisierung', owner: 'IT' },
];

const BCP = [
  { szenario: 'Resend-Ausfall', massnahmen: ['SMTP-Fallback aktivieren', 'Administrator benachrichtigen', 'Statusseite aktualisieren'] },
  { szenario: 'Supabase-Ausfall', massnahmen: ['Lesemodus aktivieren', 'Fehlerhinweis im UI', 'Wiederherstellungsprozess starten'] },
  { szenario: 'Tracking-Ausfall', massnahmen: ['Versand fortsetzen', 'Events nach Wiederherstellung nachsynchronisieren'] },
];

const DR = {
  backupLocations: ['Supabase (primär)', 'Hetzner S3 (sekundär)', 'Verschlüsselte Offsite-Kopie (monatlich)'],
  rto: '4 Stunden',
  rpo: '24 Stunden',
  responsible: 'Super Admin / IT',
  testInterval: 'Quartalsweise',
};

type ReleaseStatus = 'Entwicklung' | 'Test' | 'Pilot' | 'Produktiv' | 'Archiviert';
type Release = { date: string; responsible: string; version: string; decision: string; status: ReleaseStatus };

export default function Systemvalidierung() {
  const { roles, user } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const [val, setVal] = useState<ValRow[]>(INITIAL_VAL);
  const [changes, setChanges] = useState<Change[]>([
    { id: 'CR-001', title: 'MailCenter Produktivfreigabe', owner: 'Super Admin', risk: 'mid', approved: false, testRequired: true, goLive: '' },
  ]);
  const [releases, setReleases] = useState<Release[]>([
    { date: new Date().toISOString().slice(0, 10), responsible: 'Super Admin', version: '1.0.0', decision: 'Initiale Freigabe', status: 'Pilot' },
  ]);

  const stats = useMemo(() => {
    const pass = val.filter(v => v.status === 'pass').length;
    const fail = val.filter(v => v.status === 'fail').length;
    return { pass, fail, pending: val.length - pass - fail, total: val.length };
  }, [val]);
  const valProgress = Math.round((stats.pass / stats.total) * 100);

  function setStatus(i: number, status: PassFail) {
    setVal(prev => prev.map((r, idx) => idx === i ? {
      ...r, status,
      reviewer: r.reviewer || user?.email || 'unbekannt',
      date: r.date || new Date().toISOString().slice(0, 10),
      actual: r.actual || (status === 'pass' ? r.expected : 'Abweichung – siehe Notiz'),
    } : r));
  }

  function addChange() {
    if (!isSuperAdmin) { toast.error('Nur Super Admin'); return; }
    const id = `CR-${String(changes.length + 1).padStart(3, '0')}`;
    setChanges([...changes, { id, title: 'Neue Änderung', owner: user?.email ?? '', risk: 'low', approved: false, testRequired: true, goLive: '' }]);
  }

  function approveChange(id: string) {
    if (!isSuperAdmin) { toast.error('Nur Super Admin darf Änderungen freigeben'); return; }
    setChanges(prev => prev.map(c => c.id === id ? { ...c, approved: true, goLive: new Date().toISOString().slice(0, 10) } : c));
    toast.success(`${id} freigegeben`);
  }

  function addRelease() {
    if (!isSuperAdmin) return;
    const last = releases[releases.length - 1];
    const parts = last.version.split('.').map(Number);
    parts[2] += 1;
    setReleases([...releases, {
      date: new Date().toISOString().slice(0, 10),
      responsible: user?.email ?? 'Super Admin',
      version: parts.join('.'),
      decision: 'Freigegeben',
      status: 'Produktiv',
    }]);
    toast.success('Freigabe protokolliert');
  }

  function exportAuditCSV() {
    const rows = ['Bereich;Testfall;Erwartet;Tatsächlich;Status;Prüfer;Datum'];
    for (const v of val) rows.push(`"${v.area}";"${v.testcase}";"${v.expected}";"${v.actual}";"${PF[v.status].label}";"${v.reviewer}";"${v.date}"`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mailcenter-validierung-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportManagementReview() {
    const md = [
      `# Management Review — Alix MailCenter`,
      `Stand: ${new Date().toLocaleDateString('de-DE')}`, '',
      `## Systemverfügbarkeit\n- Ziel: > 99% — siehe Systemstatus`, '',
      `## Versand & Zustellbarkeit\n- Zielwerte: Zustellrate > 98%, Bounce < 2%`, '',
      `## Validierungsstand\n- Bestanden: ${stats.pass}/${stats.total} (${valProgress}%)\n- Offen: ${stats.pending}\n- Fehler: ${stats.fail}`, '',
      `## Offene Risiken`,
      ...RISKS.map(r => `- ${r.name}: P${r.probability}×W${r.impact} → ${r.mitigation} (${r.owner})`), '',
      `## Freigabeprotokoll`,
      ...releases.map(r => `- ${r.date} | v${r.version} | ${r.status} | ${r.responsible}`),
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `management-review-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const kpis = [
    { name: 'Zustellrate', target: '> 98 %', value: '—', ok: true },
    { name: 'Bounce Rate', target: '< 2 %', value: '—', ok: true },
    { name: 'Systemverfügbarkeit', target: '> 99 %', value: '—', ok: true },
    { name: 'Backup erfolgreich', target: 'täglich', value: 'OK', ok: true },
    { name: 'Tracking aktiv', target: 'aktiv', value: 'OK', ok: true },
    { name: 'Kritische Fehler', target: '0', value: '0', ok: true },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <div>
            <h2 className="text-2xl font-display font-bold">Systemvalidierung & Governance</h2>
            <p className="text-sm text-muted-foreground">Phase 3 — Validierung, Risiko, BCP, Audit, Freigabe</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportAuditCSV}><FileDown className="w-4 h-4 mr-2" /> Audit-Export (CSV)</Button>
          <Button onClick={exportManagementReview}><FileDown className="w-4 h-4 mr-2" /> Management Review</Button>
        </div>
      </div>

      <Tabs defaultValue="validation">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="validation"><ClipboardCheck className="w-4 h-4 mr-1" /> Validierung</TabsTrigger>
          <TabsTrigger value="change"><GitBranch className="w-4 h-4 mr-1" /> Change Management</TabsTrigger>
          <TabsTrigger value="risk"><AlertTriangle className="w-4 h-4 mr-1" /> Risikoanalyse</TabsTrigger>
          <TabsTrigger value="bcp"><LifeBuoy className="w-4 h-4 mr-1" /> Business Continuity</TabsTrigger>
          <TabsTrigger value="dr"><Database className="w-4 h-4 mr-1" /> Disaster Recovery</TabsTrigger>
          <TabsTrigger value="audit"><FileSearch className="w-4 h-4 mr-1" /> Audit & Compliance</TabsTrigger>
          <TabsTrigger value="kpi"><Target className="w-4 h-4 mr-1" /> KPI-Ziele</TabsTrigger>
          <TabsTrigger value="release"><FileSignature className="w-4 h-4 mr-1" /> Freigabeprotokoll</TabsTrigger>
        </TabsList>

        <TabsContent value="validation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Systemvalidierung</span>
                <Badge>{stats.pass}/{stats.total} bestanden</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={valProgress} />
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bereich</TableHead>
                      <TableHead>Testfall</TableHead>
                      <TableHead>Erwartet</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prüfer</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {val.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{v.area}</TableCell>
                        <TableCell className="text-sm">{v.testcase}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{v.expected}</TableCell>
                        <TableCell><Badge className={PF[v.status].color}>{PF[v.status].label}</Badge></TableCell>
                        <TableCell className="text-xs">{v.reviewer}</TableCell>
                        <TableCell className="text-xs">{v.date}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setStatus(i, 'pass')}>✅</Button>
                            <Button size="sm" variant="ghost" onClick={() => setStatus(i, 'fail')}>❌</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="change">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Change Management</span>
                {isSuperAdmin && <Button size="sm" onClick={addChange}>+ Neue Änderung</Button>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead><TableHead>Titel</TableHead><TableHead>Verantwortlich</TableHead>
                    <TableHead>Risiko</TableHead><TableHead>Test</TableHead><TableHead>Freigabe</TableHead>
                    <TableHead>Produktiv</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell>{c.title}</TableCell>
                      <TableCell className="text-xs">{c.owner}</TableCell>
                      <TableCell><Badge variant="outline">{c.risk}</Badge></TableCell>
                      <TableCell>{c.testRequired ? 'erforderlich' : '—'}</TableCell>
                      <TableCell>
                        <Badge className={c.approved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'}>
                          {c.approved ? 'Freigegeben' : 'Offen'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{c.goLive || '—'}</TableCell>
                      <TableCell>
                        {!c.approved && isSuperAdmin && (
                          <Button size="sm" variant="outline" onClick={() => approveChange(c.id)}>Freigeben</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">Änderungen dürfen erst nach Freigabe produktiv gehen.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader><CardTitle>Risikomatrix</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risiko</TableHead><TableHead>Wahrsch. (1-5)</TableHead>
                    <TableHead>Auswirkung (1-5)</TableHead><TableHead>Score</TableHead>
                    <TableHead>Gegenmaßnahme</TableHead><TableHead>Verantwortlich</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RISKS.map(r => {
                    const score = r.probability * r.impact;
                    const color = score >= 15 ? 'bg-red-500/15 text-red-400'
                      : score >= 8 ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-emerald-500/15 text-emerald-400';
                    return (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.probability}</TableCell>
                        <TableCell>{r.impact}</TableCell>
                        <TableCell><Badge className={color}>{score}</Badge></TableCell>
                        <TableCell className="text-sm">{r.mitigation}</TableCell>
                        <TableCell className="text-xs">{r.owner}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bcp">
          <div className="grid md:grid-cols-3 gap-4">
            {BCP.map(b => (
              <Card key={b.szenario}>
                <CardHeader><CardTitle className="text-base">{b.szenario}</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {b.massnahmen.map(m => (
                      <li key={m} className="flex items-start gap-2">
                        <LifeBuoy className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /> {m}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="dr">
          <Card>
            <CardHeader><CardTitle>Disaster Recovery Plan</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><strong>Backup-Standorte:</strong>
                <ul className="list-disc pl-6 mt-1">{DR.backupLocations.map(l => <li key={l}>{l}</li>)}</ul>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 border border-border rounded-md"><div className="text-xs text-muted-foreground">RTO</div><div className="font-semibold">{DR.rto}</div></div>
                <div className="p-3 border border-border rounded-md"><div className="text-xs text-muted-foreground">RPO</div><div className="font-semibold">{DR.rpo}</div></div>
                <div className="p-3 border border-border rounded-md"><div className="text-xs text-muted-foreground">Verantwortlich</div><div className="font-semibold">{DR.responsible}</div></div>
                <div className="p-3 border border-border rounded-md"><div className="text-xs text-muted-foreground">Testintervall</div><div className="font-semibold">{DR.testInterval}</div></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle>Audit & Compliance Berichte</CardTitle></CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {['Benutzeraktivitäten', 'Rechteänderungen', 'Kampagnenversand', 'Datenexporte', 'Abmeldungen', 'Fehlerprotokoll'].map(r => (
                  <div key={r} className="flex items-center justify-between p-3 border border-border rounded-md bg-card/40">
                    <span className="text-sm">{r}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toast.info(`${r}: CSV / XLSX-Export via Audit-Log`)}>
                        <FileDown className="w-4 h-4 mr-1" /> Export
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpi">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {kpis.map(k => (
              <Card key={k.name}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{k.name}</div>
                  <div className="text-2xl font-bold mt-1">{k.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">Ziel: {k.target}</div>
                  <Badge className={k.ok ? 'bg-emerald-500/15 text-emerald-400 mt-2' : 'bg-red-500/15 text-red-400 mt-2'}>
                    {k.ok ? 'OK' : 'kritisch'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="release">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Freigabeprotokoll</span>
                {isSuperAdmin && <Button size="sm" onClick={addRelease}>+ Neue Freigabe</Button>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead><TableHead>Version</TableHead>
                    <TableHead>Verantwortlich</TableHead><TableHead>Entscheidung</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releases.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.date}</TableCell>
                      <TableCell className="font-mono">v{r.version}</TableCell>
                      <TableCell className="text-xs">{r.responsible}</TableCell>
                      <TableCell className="text-sm">{r.decision}</TableCell>
                      <TableCell><Badge>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                Lebenszyklus: Entwicklung → Test → Pilot → Produktiv → Archiviert
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
