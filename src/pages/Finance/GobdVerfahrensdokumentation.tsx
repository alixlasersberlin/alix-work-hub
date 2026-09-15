import { useEffect, useMemo, useState } from 'react';
import { BookLock, Download, RefreshCw, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logGobdExport } from '@/lib/finance/gobd';
import { MarkdownLite } from '@/components/finance/MarkdownLite';

type Doc = { id: string; version: string; section: string; title: string; content_md: string; valid_from: string; superseded_by: string | null; created_at: string };
type MatrixRow = { id: string; role_name: string; area: string; can_read: boolean; can_create: boolean; can_update: boolean; can_delete: boolean; can_export: boolean; can_approve: boolean; enforced_by: string | null; note: string | null };
type FourEyes = { id: string; process: string; requirement_level: string; rationale: string; current_state: string | null; implementation_status: string };
type ChangeRow = { id: string; version: string; changed_at: string; responsible: string; area: string; description: string; evidence: string | null; phase: string | null };
type CheckRow = { bereich: string; pruefung: string; status: string; detail: string };

const Yes = ({ v }: { v: boolean }) => v
  ? <Check className="h-4 w-4 text-emerald-500" aria-label="ja" />
  : <X className="h-4 w-4 text-muted-foreground/40" aria-label="nein" />;

function statusVariant(s: string): 'outline' | 'destructive' | 'secondary' {
  if (s === 'BESTANDEN') return 'outline';
  if (s === 'FEHLER') return 'destructive';
  return 'secondary';
}

function download(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: mime }));
  a.download = name;
  a.click();
}

export default function GobdVerfahrensdokumentation() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [fourEyes, setFourEyes] = useState<FourEyes[]>([]);
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<string>('');

  async function load() {
    setLoading(true);
    const [d, m, f, c, chk] = await Promise.all([
      (supabase as any).from('gobd_procedure_docs').select('*').order('section'),
      (supabase as any).from('gobd_permission_matrix').select('*').order('role_name').order('area'),
      (supabase as any).from('gobd_four_eyes_recommendations').select('*').order('requirement_level').order('process'),
      (supabase as any).from('gobd_change_log').select('*').order('changed_at', { ascending: false }),
      (supabase as any).rpc('gobd_phase13_check'),
    ]);
    const err = d.error || m.error || f.error || c.error || chk.error;
    if (err) toast.error(err.message);
    setDocs((d.data ?? []) as Doc[]);
    setMatrix((m.data ?? []) as MatrixRow[]);
    setFourEyes((f.data ?? []) as FourEyes[]);
    setChanges((c.data ?? []) as ChangeRow[]);
    setChecks((chk.data ?? []) as CheckRow[]);
    const versions = Array.from(new Set(((d.data ?? []) as Doc[]).map(x => x.version))).sort().reverse();
    setVersion(v => v || versions[0] || '');
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const versions = useMemo(() => Array.from(new Set(docs.map(d => d.version))).sort().reverse(), [docs]);
  const shown = useMemo(() => docs.filter(d => d.version === version), [docs, version]);
  const roles = useMemo(() => Array.from(new Set(matrix.map(m => m.role_name))), [matrix]);

  const fehler = checks.filter(c => c.status === 'FEHLER').length;
  const offen = checks.filter(c => c.status === 'OFFEN').length;
  const warn = checks.filter(c => c.status === 'WARNUNG').length;
  const gesamt = loading ? '…' : fehler ? 'FEHLER' : offen ? 'OFFEN' : warn ? 'WARNUNG' : 'BESTANDEN';

  async function exportDoc() {
    const content = shown.map(d => d.content_md.trim()).join('\n\n---\n\n');
    const head = `# GoBD-Verfahrensdokumentation AlixWork — Version ${version}\n\nStand: ${new Date().toLocaleString('de-DE')}\n\n`;
    const fileName = `GoBD_Verfahrensdokumentation_v${version}.md`;
    download(fileName, head + content, 'text/markdown;charset=utf-8');
    await logGobdExport({ exportType: 'GOBD_VERFAHRENSDOKU', fileName, recordCount: shown.length, content: head + content, status: 'CREATED', metadata: { version } });
    toast.success('Verfahrensdokumentation exportiert');
  }

  async function exportMatrix() {
    const head = 'Rolle;Bereich;Lesen;Anlegen;Ändern;Löschen;Exportieren;Freigeben;Durchsetzung;Bemerkung';
    const b = (v: boolean) => (v ? 'ja' : 'nein');
    const content = [head, ...matrix.map(m => [m.role_name, m.area, b(m.can_read), b(m.can_create), b(m.can_update), b(m.can_delete), b(m.can_export), b(m.can_approve), m.enforced_by ?? '', m.note ?? '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const fileName = `GoBD_Berechtigungskonzept_${new Date().toISOString().slice(0, 10)}.csv`;
    download(fileName, content);
    await logGobdExport({ exportType: 'GOBD_BERECHTIGUNGSKONZEPT', fileName, recordCount: matrix.length, content, status: 'CREATED' });
    toast.success('Berechtigungskonzept exportiert');
  }

  async function exportReport() {
    const lines = [
      'GoBD Phase 13 – Verfahrensdokumentation und Berechtigungskonzept',
      `Erstellt am;${new Date().toLocaleString('de-DE')}`,
      `Gesamtstatus;${gesamt}`,
      '',
      'Bereich;Prüfung;Status;Detail',
      ...checks.map(c => [c.bereich, c.pruefung, c.status, c.detail].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')),
    ].join('\n');
    const fileName = `GoBD_Phase13_Pruefbericht_${new Date().toISOString().slice(0, 10)}.csv`;
    download(fileName, lines);
    await logGobdExport({ exportType: 'GOBD_PHASE13_REPORT', fileName, recordCount: checks.length, content: lines, status: 'CREATED', metadata: { gesamt } });
    toast.success('Prüfbericht erstellt');
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={BookLock}
        title="GoBD Verfahrensdokumentation & Berechtigungskonzept"
        subtitle="Phase 13 – versionierte Dokumentation, Rollenmatrix, Vier-Augen-Bewertung und Änderungsprotokoll"
        actions={<>
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={exportReport} disabled={loading}><Download className="h-4 w-4 mr-2" />Prüfbericht</Button>
        </>}
      />

      <Card className="border-amber-500/40">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant(gesamt)}>{gesamt}</Badge>
          <span className="text-sm text-muted-foreground">
            Technische GoBD-Prüfung bestanden – organisatorischer Abschluss läuft (Phasen 14 bis 17 stehen aus).
          </span>
        </CardContent>
      </Card>

      <Tabs defaultValue="doku">
        <TabsList className="flex-wrap">
          <TabsTrigger value="doku">Verfahrensdokumentation</TabsTrigger>
          <TabsTrigger value="rechte">Berechtigungskonzept</TabsTrigger>
          <TabsTrigger value="vieraugen">Vier-Augen-Prinzip</TabsTrigger>
          <TabsTrigger value="aenderungen">Änderungsprotokoll</TabsTrigger>
          <TabsTrigger value="pruefung">Prüfbericht</TabsTrigger>
        </TabsList>

        <TabsContent value="doku" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={version} onValueChange={setVersion}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Version" /></SelectTrigger>
              <SelectContent>{versions.map(v => <SelectItem key={v} value={v}>Version {v}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={exportDoc} disabled={shown.length === 0}>
              <Download className="h-4 w-4 mr-2" />Dokumentation exportieren
            </Button>
            <span className="text-xs text-muted-foreground">
              Ältere Fassungen bleiben dauerhaft erhalten; eine neue Version überschreibt keine alte.
            </span>
          </div>
          {shown.map(d => (
            <Card key={d.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{d.title}</CardTitle>
                <div className="flex items-center gap-2">
                  {d.superseded_by && <Badge variant="secondary">abgelöst</Badge>}
                  <Badge variant="outline">v{d.version} · gültig ab {new Date(d.valid_from).toLocaleDateString('de-DE')}</Badge>
                </div>
              </CardHeader>
              <CardContent><MarkdownLite content={d.content_md} /></CardContent>
            </Card>
          ))}
          {!loading && shown.length === 0 && <p className="text-sm text-muted-foreground">Keine Fassung vorhanden.</p>}
        </TabsContent>

        <TabsContent value="rechte" className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={exportMatrix} disabled={matrix.length === 0}>
              <Download className="h-4 w-4 mr-2" />Matrix exportieren
            </Button>
            <span className="text-xs text-muted-foreground">{roles.length} Rollen · {matrix.length} Einträge</span>
          </div>
          <Card>
            <CardContent className="overflow-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rolle</TableHead><TableHead>Bereich</TableHead>
                    <TableHead className="text-center">Lesen</TableHead><TableHead className="text-center">Anlegen</TableHead>
                    <TableHead className="text-center">Ändern</TableHead><TableHead className="text-center">Löschen</TableHead>
                    <TableHead className="text-center">Export</TableHead><TableHead className="text-center">Freigeben</TableHead>
                    <TableHead>Durchsetzung</TableHead><TableHead>Bemerkung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs font-medium whitespace-nowrap">{m.role_name}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{m.area}</TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Yes v={m.can_read} /></div></TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Yes v={m.can_create} /></div></TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Yes v={m.can_update} /></div></TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Yes v={m.can_delete} /></div></TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Yes v={m.can_export} /></div></TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Yes v={m.can_approve} /></div></TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{m.enforced_by}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground max-w-xs">{m.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vieraugen" className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Bewertung und Empfehlung. Es wurden keine produktiven Abläufe verändert.
          </p>
          <Card>
            <CardContent className="overflow-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Vorgang</TableHead><TableHead>Einstufung</TableHead><TableHead>Begründung</TableHead><TableHead>Heutiger Stand</TableHead><TableHead>Umsetzung</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {fourEyes.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs font-medium">{f.process}</TableCell>
                      <TableCell><Badge variant={f.requirement_level === 'ERFORDERLICH' ? 'destructive' : 'secondary'}>{f.requirement_level}</Badge></TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{f.rationale}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{f.current_state}</TableCell>
                      <TableCell><Badge variant={f.implementation_status === 'UMGESETZT' ? 'outline' : 'secondary'}>{f.implementation_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aenderungen">
          <Card>
            <CardContent className="overflow-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Datum</TableHead><TableHead>Version</TableHead><TableHead>Verantwortlich</TableHead><TableHead>Bereich</TableHead><TableHead>Beschreibung</TableHead><TableHead>Prüfnachweis</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {changes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(c.changed_at).toLocaleDateString('de-DE')}</TableCell>
                      <TableCell className="text-xs">{c.version}</TableCell>
                      <TableCell className="text-xs">{c.responsible}</TableCell>
                      <TableCell className="text-xs">{c.area}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{c.description}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{c.evidence}{c.phase ? ` (${c.phase})` : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="p-4 text-[11px] text-muted-foreground">Einträge im Änderungsprotokoll können nicht geändert oder gelöscht werden.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pruefung">
          <Card>
            <CardHeader><CardTitle className="text-sm">GoBD Phase 13 – Verfahrensdokumentation und Berechtigungskonzept</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Bereich</TableHead><TableHead>Prüfung</TableHead><TableHead className="w-32">Status</TableHead><TableHead>Detail</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {checks.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{c.bereich}</TableCell>
                      <TableCell className="text-xs">{c.pruefung}</TableCell>
                      <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{c.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-4 text-[11px] text-muted-foreground">
                Punkte werden nur dann als bestanden ausgewiesen, wenn sie technisch oder organisatorisch nachweisbar sind.
                Der Status „GoBD-Gesamtprüfung bestanden“ ist erst nach Phase 17 zulässig.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
