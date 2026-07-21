import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Files, Lock, Loader2, Download, Archive, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const FN_URL = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/alixdocs-share-access`;
const TRACK_URL = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/alixdocs-widget-track`;
const ANON = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;

const track = (token: string, event_type: string, extra: Record<string, any> = {}) => {
  try {
    fetch(TRACK_URL, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ token, event_type, ...extra }),
    }).catch(() => {});
  } catch {}
};

type DocMeta = { id: string; title: string; filename: string | null; mime_type: string; size: number; version: number };

export default function AlixDocsSharePublic() {
  const { token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [docs, setDocs] = useState<DocMeta[] | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [busy, setBusy] = useState(false);

  const request = async (mode: string, extra: any = {}) => {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ token, mode, password: password || null, ...extra }),
    });
    return res;
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}&mode=meta`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        const d = await res.json();
        setMeta(d);
        if (!d.requires_password && !d.error) {
          const list = await request('list');
          const j = await list.json();
          if (j.documents) setDocs(j.documents);
        }
      } catch (e: any) { toast.error(e?.message || 'Fehler'); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const unlock = async () => {
    setUnlocking(true);
    try {
      const res = await request('list');
      const j = await res.json();
      if (j.error) { toast.error(j.error === 'invalid_password' ? 'Falsches Passwort' : j.error); return; }
      setDocs(j.documents);
    } finally { setUnlocking(false); }
  };

  const downloadOne = async (d: DocMeta) => {
    setBusy(true);
    try {
      const res = await request('signed_url', { document_id: d.id });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      window.open(j.url, '_blank');
    } catch (e: any) { toast.error(e?.message || 'Download fehlgeschlagen'); }
    finally { setBusy(false); }
  };

  const downloadZip = async () => {
    setBusy(true);
    try {
      const res = await request('zip');
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `alixdocs_${token.slice(0, 8)}.zip`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e: any) { toast.error(e?.message || 'ZIP fehlgeschlagen'); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Files className="w-5 h-5 text-primary" />
            AlixDocs — Freigegebene Dokumente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Lade …</div>
          ) : meta?.error ? (
            <div className="text-center py-10">
              <p className="text-lg font-semibold text-red-400">
                {meta.error === 'expired' ? 'Link abgelaufen' :
                 meta.error === 'revoked' ? 'Link widerrufen' :
                 meta.error === 'download_limit_reached' ? 'Download-Limit erreicht' :
                 'Link ungültig'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Bitte kontaktiere den Absender.</p>
            </div>
          ) : !docs ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
                <Lock className="w-5 h-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Passwort erforderlich</p>
                  <p className="text-muted-foreground">Diese Freigabe ist passwortgeschützt.</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Passwort</label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && unlock()} autoFocus />
              </div>
              <Button className="w-full" onClick={unlock} disabled={unlocking || !password}>
                {unlocking && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Entsperren
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline"><ShieldCheck className="w-3 h-3 mr-1" /> {docs.length} Dokumente</Badge>
                {meta?.expires_at && <Badge variant="outline">gültig bis {new Date(meta.expires_at).toLocaleDateString('de-DE')}</Badge>}
                {meta?.max_downloads && <Badge variant="outline">max {meta.max_downloads} Downloads</Badge>}
                <div className="ml-auto">
                  <Button size="sm" onClick={downloadZip} disabled={busy}>
                    <Archive className="w-4 h-4 mr-1" /> Alle als ZIP
                  </Button>
                </div>
              </div>
              <div className="border border-border rounded-md divide-y divide-border/50">
                {docs.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 hover:bg-muted/30">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.title}</div>
                      {d.filename && <div className="text-xs text-muted-foreground font-mono truncate">{d.filename}</div>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadOne(d)} disabled={busy}>
                      <Download className="w-4 h-4 mr-1" /> Öffnen
                    </Button>
                  </div>
                ))}
              </div>
              {meta?.note && <p className="text-xs text-muted-foreground italic">Notiz vom Absender: {meta.note}</p>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
