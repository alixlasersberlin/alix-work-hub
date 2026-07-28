import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Download, Link2, Copy } from 'lucide-react';

type Client = { id: string; company_name: string };

export default function SocialReports() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [range, setRange] = useState({
    from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('social_clients').select('id,company_name').is('deleted_at', null).order('company_name')
      .then(({ data }) => setClients(data ?? []));
  }, []);

  async function load() {
    if (!clientId) return;
    const [{ data: r }, { data: l }] = await Promise.all([
      supabase.from('social_reports').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('social_portal_links').select('*').eq('client_id', clientId).is('disabled_at', null).order('created_at', { ascending: false }),
    ]);
    setReports(r ?? []); setLinks(l ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  async function generate() {
    if (!clientId) return;
    setLoading(true);
    const { error } = await supabase.functions.invoke('social-report-generate', {
      body: { client_id: clientId, period_start: range.from, period_end: range.to },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Report erzeugt');
    load();
  }

  async function download(path: string) {
    const { data } = await supabase.storage.from('social-media-library').createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function createLink() {
    if (!clientId) return;
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().slice(0, 8);
    const { error } = await supabase.from('social_portal_links').insert({
      client_id: clientId, token,
      expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success('Kunden-Link erstellt');
    load();
  }

  async function disableLink(id: string) {
    await supabase.from('social_portal_links').update({ disabled_at: new Date().toISOString() }).eq('id', id);
    load();
  }

  function portalUrl(token: string) {
    return `${window.location.origin}/social-portal/${token}`;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Kunden-Portal</h1>
        <p className="text-muted-foreground mt-1">PDF-Reports und teilbare Analytics-Links für Endkunden</p>
      </div>

      <Card><CardContent className="pt-6">
        <Label>Kunde</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="max-w-md mt-1"><SelectValue placeholder="Kunde…" /></SelectTrigger>
          <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
        </Select>
      </CardContent></Card>

      {clientId && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Report generieren</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div><Label>Von</Label><Input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} /></div>
                <div><Label>Bis</Label><Input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} /></div>
                <div className="flex items-end"><Button onClick={generate} disabled={loading} className="w-full">Report erzeugen</Button></div>
              </div>

              {reports.length === 0 && <div className="text-center py-4 text-muted-foreground text-sm">Noch keine Reports.</div>}
              {reports.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                  <div>
                    <div className="font-medium">{r.period_start} – {r.period_end}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.summary?.posts_published ?? 0} Posts · {Number(r.summary?.totals?.impressions ?? 0).toLocaleString('de-DE')} Impressions
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{r.status}</Badge>
                    {r.pdf_path && <Button size="sm" variant="outline" onClick={() => download(r.pdf_path)}><Download className="mr-2 h-3 w-3" />HTML</Button>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Kunden-Portal-Links</CardTitle>
              <Button onClick={createLink} size="sm">Neuen Link erstellen</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {links.length === 0 && <div className="text-center py-4 text-muted-foreground text-sm">Keine aktiven Links.</div>}
              {links.map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono truncate">{portalUrl(l.token)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {l.view_count} Aufrufe · gültig bis {l.expires_at ? new Date(l.expires_at).toLocaleDateString('de-DE') : '∞'}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(portalUrl(l.token)); toast.success('Link kopiert'); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => disableLink(l.id)}>Deaktivieren</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
