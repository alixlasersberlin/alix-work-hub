import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ClipboardCheck, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

const tone = (s: string) => s === 'green' ? 'bg-emerald-500' : s === 'amber' ? 'bg-amber-500' : 'bg-destructive';
const dot = (s: string) => <span className={`inline-block h-2.5 w-2.5 rounded-full ${tone(s)}`} />;
const short = (v: any) => {
  if (v === null || v === undefined) return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 120) + '…' : s;
};

export default function ProductHubValidierung() {
  const { roles } = useAuth();
  const canRun = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const loadLast = async () => {
    const { data } = await db.from('ph_validation_runs').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data) setRun(data);
  };
  useEffect(() => { loadLast(); }, []);

  const start = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('product-hub-validate', { body: { check_urls: true, compare_live: true } });
      if (error) throw error;
      setRun(data);
      toast.success(`Validierung abgeschlossen – Empfehlung: ${data.recommendation}`);
    } catch (e: any) {
      toast.error(e.message || 'Validierung fehlgeschlagen');
    } finally { setBusy(false); }
  };

  const s = run?.summary || {};
  const products = run?.products || [];
  const media = run?.media || [];
  const documents = run?.documents || [];
  const refDiff = run?.reference_diff || [];
  const overrides = run?.overrides || [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Phase-B-Validierung" subtitle="Vollständigkeit, Medien, Dokumente, Referenzvergleich und Phase-C-Readiness – rein prüfend" icon={ClipboardCheck} />

      <Card><CardContent className="p-3 flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={busy || !canRun}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Validierung starten
        </Button>
        <span className="text-xs text-muted-foreground">
          Es werden keine Daten verändert, keine Medien gelöscht und keine fehlenden Werte ergänzt.
        </span>
        {run?.created_at && <span className="text-xs text-muted-foreground ml-auto">Letzter Lauf: {new Date(run.created_at).toLocaleString('de-DE')}</span>}
      </CardContent></Card>

      {!run && <Card><CardContent className="py-10 text-center text-muted-foreground">Noch keine Validierung durchgeführt.</CardContent></Card>}

      {run && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              ['Geräte gesamt', s.total], ['Ø Quality Score', `${s.avg_score ?? 0} %`],
              ['DE-ready', s.de_ready], ['COM-ready', s.com_ready], ['Master-ready', s.master_ready],
              ['Review erforderlich', s.review_required],
            ].map(([l, v]) => (
              <Card key={String(l)}><CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground">{l}</div>
                <div className="text-xl font-semibold">{String(v ?? '—')}</div>
              </CardContent></Card>
            ))}
          </div>

          <Card className={run.recommendation === 'GO' ? 'border-emerald-500/50' : 'border-amber-500/50'}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">PHASE C READINESS</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="grid md:grid-cols-4 gap-2 text-xs">
                <div>Gesamtgeräte: <b>{s.total}</b></div>
                <div>Master-ready: <b>{s.master_ready}</b></div>
                <div>DE-ready: <b>{s.de_ready}</b></div>
                <div>COM-ready: <b>{s.com_ready}</b></div>
                <div>Medienfehler: <b className={s.media_errors ? 'text-destructive' : ''}>{s.media_errors}</b></div>
                <div>Dokumentenfehler (echte Dokumente): <b className={s.document_errors ? 'text-destructive' : ''}>{s.document_errors}</b></div>
                <div>Landingpage-Warnungen: <b className={s.landing_page_warnings ? 'text-amber-600' : ''}>{s.landing_page_warnings ?? 0}</b> / {s.landing_pages_total ?? 0}</div>
                <div>Technische Reviews: <b>{s.tech_reviews}</b></div>
                <div>Manual Overrides: <b>{s.manual_overrides}</b></div>
                <div>Konflikte: <b>{s.conflicts}</b></div>
                <div>Publish Queue: <b>vorhanden</b></div>
                <div>Rollback: <b>vorbereitet</b></div>
                <div>API DE / COM: <b>bereit (read-only)</b></div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Badge className={run.recommendation === 'GO' ? 'bg-emerald-500' : 'bg-amber-500'}>{run.recommendation}</Badge>
                <span className="text-xs text-muted-foreground">{run.reason}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Migrationsphase bleibt <b>B</b>. COM→DE Sync bleibt aktiv. Keine automatische Umschaltung.
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="geraete">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="geraete">Geräte ({products.length})</TabsTrigger>
              <TabsTrigger value="referenz">Referenzgeräte</TabsTrigger>
              <TabsTrigger value="override">Manual Override ({overrides.length})</TabsTrigger>
              <TabsTrigger value="medien">Medien ({media.length})</TabsTrigger>
              <TabsTrigger value="dokumente">Dokumente ({documents.length})</TabsTrigger>
              <TabsTrigger value="technik">Technische Daten</TabsTrigger>
              <TabsTrigger value="readiness">Channel Readiness</TabsTrigger>
            </TabsList>

            <TabsContent value="geraete">
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Gerät</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead><TableHead>Fehlend</TableHead><TableHead>Medien</TableHead><TableHead>Dokumente</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {products.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell><Link to={`/product-hub/geraete/${p.id}`} className="text-primary hover:underline">{p.name}</Link></TableCell>
                        <TableCell className="w-40"><div className="flex items-center gap-2"><Progress value={p.score} className="h-2 w-24" /><span className="text-xs">{p.score}%</span></div></TableCell>
                        <TableCell>{dot(p.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[340px]">{p.missing.join(', ') || '—'}</TableCell>
                        <TableCell className="text-xs">{p.media_count}{p.media_errors ? <span className="text-destructive"> ({p.media_errors} Fehler)</span> : null}</TableCell>
                        <TableCell className="text-xs">{p.document_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="referenz" className="space-y-3">
              {refDiff.map((r: any) => (
                <Card key={r.key}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
                    {r.name}
                    <Badge variant="outline">{r.found_master ? 'Master ✓' : 'Master fehlt'}</Badge>
                    <Badge variant="outline">{r.found_live ? 'DE Live ✓' : 'DE Live fehlt'}</Badge>
                    <Badge className={r.diffs ? 'bg-amber-500' : 'bg-emerald-500'}>{r.diffs} Abweichungen</Badge>
                  </CardTitle></CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Feld</TableHead><TableHead>ALIXWORK MASTER</TableHead><TableHead>DE LIVE</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {(r.fields || []).map((f: any) => (
                          <TableRow key={f.field} className={f.equal ? '' : 'bg-amber-500/5'}>
                            <TableCell className="text-xs font-medium">{f.field}</TableCell>
                            <TableCell className="text-xs max-w-[320px] break-words">{short(f.master)}</TableCell>
                            <TableCell className="text-xs max-w-[320px] break-words">{short(f.live)}</TableCell>
                            <TableCell>{f.equal ? <Badge variant="outline" className="text-emerald-500 border-emerald-500/40">identisch</Badge> : <Badge variant="outline" className="text-amber-500 border-amber-500/40">abweichend</Badge>}</TableCell>
                          </TableRow>
                        ))}
                        {(r.fields || []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Kein Vergleich möglich.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
              {s.live_error && <div className="text-xs text-destructive">DE-Live-Vergleich: {s.live_error}</div>}
            </TabsContent>

            <TabsContent value="override">
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Gerät</TableHead><TableHead>Feld</TableHead><TableHead>Master-Wert</TableHead><TableHead>DE-Wert</TableHead><TableHead>Grund Schutz</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {overrides.map((o: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{o.product}</TableCell>
                        <TableCell className="text-xs">{o.field}</TableCell>
                        <TableCell className="text-xs">{short(o.master_value)}</TableCell>
                        <TableCell className="text-xs">{short(o.live_value)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{o.reason}</TableCell>
                      </TableRow>
                    ))}
                    {overrides.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Keine geschützten Felder.</TableCell></TableRow>}
                  </TableBody>
                </Table>
                <div className="p-3 text-xs text-muted-foreground">Schutz wird nicht automatisch entfernt.</div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="medien">
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Art</TableHead><TableHead>URL</TableHead><TableHead>HTTP</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {media.filter((m: any) => m.state !== 'erreichbar').concat(media.filter((m: any) => m.state === 'erreichbar')).slice(0, 400).map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell><Badge variant="outline" className={m.state === 'erreichbar' ? 'text-emerald-500 border-emerald-500/40' : m.state === 'Duplikat' ? 'text-sky-500 border-sky-500/40' : 'text-destructive border-destructive/40'}>{m.state}</Badge></TableCell>
                        <TableCell className="text-xs">{m.kind}</TableCell>
                        <TableCell className="text-xs max-w-[520px] truncate"><a href={m.url} target="_blank" rel="noreferrer" className="hover:underline">{m.url}</a></TableCell>
                        <TableCell className="text-xs">{String(m.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-3 text-xs text-muted-foreground">Es werden keine Medien automatisch gelöscht.</div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="dokumente">
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Titel</TableHead><TableHead>Typ</TableHead><TableHead>Sichtbarkeit</TableHead><TableHead>Dateiname</TableHead><TableHead>Zuordnung</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {documents.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell><Badge variant="outline" className={d.state === 'erreichbar' ? 'text-emerald-500 border-emerald-500/40' : 'text-destructive border-destructive/40'}>{d.state}</Badge></TableCell>
                        <TableCell className="text-xs max-w-[260px] truncate"><a href={d.url} target="_blank" rel="noreferrer" className="hover:underline">{d.title}</a></TableCell>
                        <TableCell className="text-xs">{d.doc_type}</TableCell>
                        <TableCell className="text-xs">{d.visibility}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate">{d.filename || '—'}</TableCell>
                        <TableCell className="text-xs">{d.orphan ? <span className="text-destructive">fehlt</span> : 'ok'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-3 text-xs text-muted-foreground">
                  Regulatorische Dokumente aus dem Webseitenimport bleiben Website-Dokumente – sie werden nicht zum regulatorischen Master erklärt.
                </div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="technik">
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Gerät</TableHead><TableHead>Specs</TableHead><TableHead>Wellenlängen</TableHead><TableHead>Leistung</TableHead><TableHead>Kühlung</TableHead><TableHead>weitere technische Daten</TableHead><TableHead>Review</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {products.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{p.name}</TableCell>
                        <TableCell className="text-xs">{p.tech.specs ? 'ja' : '—'}</TableCell>
                        <TableCell className="text-xs">{p.tech.wavelengths || '—'}</TableCell>
                        <TableCell className="text-xs">{p.tech.power || '—'}</TableCell>
                        <TableCell className="text-xs">{p.tech.cooling || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{[p.tech.fluence, p.tech.pulse_duration, p.tech.frequency, p.tech.spot_sizes, p.tech.laser_class].filter(Boolean).join(' · ') || '—'}</TableCell>
                        <TableCell>{p.tech.review ? <Badge variant="outline" className="text-amber-500 border-amber-500/40">fehlt: {p.tech.missing.join(', ')}</Badge> : <Badge variant="outline" className="text-emerald-500 border-emerald-500/40">ok</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-3 text-xs text-muted-foreground">Fehlende technische Werte werden nicht erfunden und nicht von ähnlichen Geräten übernommen.</div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="readiness">
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Gerät</TableHead><TableHead>DE READY</TableHead><TableHead>COM READY</TableHead><TableHead>MASTER READY</TableHead><TableHead>fehlende Inhalte</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {products.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{p.name}</TableCell>
                        <TableCell>{p.readiness.de ? '🟢' : '🔴'}</TableCell>
                        <TableCell>{p.readiness.com ? '🟢' : '🔴'}</TableCell>
                        <TableCell>{p.readiness.master ? '🟢' : '🔴'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[420px]">{[...p.missing, ...p.tech.missing].join(', ') || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
