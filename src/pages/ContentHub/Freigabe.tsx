import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Check, Download, Layers, Loader2, Rocket, X } from 'lucide-react';
import { toast } from 'sonner';
import { CH_CHANNELS, CH_STAGES, chChannelLabel } from '@/lib/contenthub/config';
import { chDatasheetPdf, chLoadReleases, chPreview, chPublish, type ChResult } from '@/lib/contenthub/api';

function Value({ v }: { v: any }) {
  if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(v)) return <span>{v.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ')}</span>;
  if (typeof v === 'object') {
    return (
      <div className="space-y-0.5">
        {Object.entries(v).map(([k, val]) => (
          <div key={k} className="text-xs"><span className="text-muted-foreground">{k}:</span> <Value v={val} /></div>
        ))}
      </div>
    );
  }
  if (typeof v === 'boolean') return <span>{v ? 'Ja' : 'Nein'}</span>;
  return <span>{String(v)}</span>;
}

export default function ContentHubFreigabe() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ChResult | null>(null);
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [res, rel] = await Promise.all([chPreview(id), chLoadReleases(id)]);
      setData(res); setReleases(rel);
    } catch (e: any) {
      toast.error(e.message || 'Vorschau fehlgeschlagen');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const publish = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const [r] = await chPublish([id], undefined, note);
      if (r?.published) toast.success(`Release v${r.version} auf allen Kanälen veröffentlicht`);
      else toast.error(`Blockiert: ${r?.blocked?.join(' · ')}`);
      setNote('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Veröffentlichung fehlgeschlagen');
    } finally { setBusy(false); }
  };

  const blocked = (data?.blocked?.length ?? 0) > 0;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title={data?.name ? `Freigabe · ${data.name}` : 'Content Hub Freigabe'}
        subtitle={CH_STAGES.join('  →  ')}
        icon={Layers}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/content-hub"><ArrowLeft className="h-4 w-4 mr-2" />Cockpit</Link></Button>
            <Button size="sm" onClick={publish} disabled={busy || loading || blocked}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              Freigeben & überall veröffentlichen
            </Button>
          </div>
        }
      />

      {loading && <div className="p-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>}

      {!loading && data && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Freigabekette</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(data.checks ?? []).map(c => (
                  <div key={c.label} className="flex items-center gap-2 text-sm">
                    {c.ok ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-destructive" />}
                    <span className={c.ok ? '' : 'text-destructive'}>{c.label}</span>
                  </div>
                ))}
                {data.compliance_required && (
                  <Badge variant="outline" className="text-[10px] mt-2">Compliance-Freigabe erforderlich (MDR / ISO 13485)</Badge>
                )}
                <Textarea className="mt-3" rows={2} placeholder="Freigabe-Notiz (revisionssicher gespeichert)" value={note} onChange={e => setNote(e.target.value)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Kanalstatus</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {CH_CHANNELS.map(c => {
                  const s = (data.channel_state ?? []).find((x: any) => x.channel === c.code);
                  const stale = !!s?.published_hash && s.published_hash !== data.hash;
                  return (
                    <div key={c.code} className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><c.icon className="h-4 w-4 text-muted-foreground" />{c.label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {!s?.published_at ? 'nie' : stale ? `v${s.published_version} veraltet` : `v${s.published_version} aktuell`}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Vorschau je Kanal</CardTitle>
              <Button size="sm" variant="outline" onClick={() => chDatasheetPdf(data.rendered?.datasheet)} disabled={!data.rendered?.datasheet}>
                <Download className="h-4 w-4 mr-2" />Datenblatt PDF
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="website">
                <TabsList className="flex-wrap h-auto">
                  {CH_CHANNELS.map(c => <TabsTrigger key={c.code} value={c.code}>{c.label}</TabsTrigger>)}
                </TabsList>
                {CH_CHANNELS.map(c => (
                  <TabsContent key={c.code} value={c.code} className="pt-3">
                    <p className="text-xs text-muted-foreground mb-2">{c.hint}</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {Object.entries(data.rendered?.[c.code] ?? {}).map(([k, v]) => (
                        <div key={k} className="rounded-md border p-2">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
                          <div className="text-sm break-words"><Value v={v} /></div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Release-Historie (WORM)</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs"><tr>
                  <th className="p-2 text-left">Version</th><th className="p-2 text-left">Datum</th>
                  <th className="p-2 text-left">Status</th><th className="p-2 text-left">Hash</th><th className="p-2 text-left">Notiz</th>
                </tr></thead>
                <tbody>
                  {releases.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 font-medium">v{r.version}</td>
                      <td className="p-2">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.status}</Badge></td>
                      <td className="p-2 font-mono text-[10px]">{String(r.content_hash).slice(0, 12)}…</td>
                      <td className="p-2 text-muted-foreground">{r.note ?? '—'}</td>
                    </tr>
                  ))}
                  {!releases.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Noch kein Release veröffentlicht.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
