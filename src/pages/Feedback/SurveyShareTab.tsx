// Teilen-Tab: offener Umfrage-Link (ohne Einladung) inkl. QR-Code.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Copy, Download, RefreshCw, QrCode } from 'lucide-react';

const PUBLIC_BASE = 'https://alixwork.de';

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function SurveyShareTab({ surveyId }: { surveyId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [qr, setQr] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const link = token ? `${PUBLIC_BASE}/umfrage/${token}` : '';

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('surveys')
        .select('public_token, public_enabled').eq('id', surveyId).maybeSingle();
      setToken((data as any)?.public_token ?? null);
      setEnabled(Boolean((data as any)?.public_enabled));
    })();
  }, [surveyId]);

  useEffect(() => {
    if (!link) { setQr(''); return; }
    QRCode.toDataURL(link, { width: 512, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [link]);

  const persist = async (patch: Record<string, unknown>) => {
    setBusy(true);
    const { error } = await supabase.from('surveys').update(patch as any).eq('id', surveyId);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const generate = async () => {
    const t = randomToken();
    if (await persist({ public_token: t, public_enabled: true })) {
      setToken(t); setEnabled(true);
      toast.success('Offener Link erstellt');
    }
  };

  const toggle = async (v: boolean) => {
    if (v && !token) return generate();
    if (await persist({ public_enabled: v })) { setEnabled(v); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card><CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Offener Teilnahme-Link</Label>
            <p className="text-sm text-muted-foreground">
              Jeder mit dem Link (oder QR-Code) kann anonym teilnehmen – ohne persönliche Einladung.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} disabled={busy} />
        </div>

        {token ? (
          <>
            <div className="flex gap-2">
              <Input readOnly value={link} />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success('Link kopiert'); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={generate} disabled={busy} title="Neuen Link erzeugen (alter Link wird ungültig)">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {!enabled && <p className="text-sm text-amber-500">Der Link ist derzeit deaktiviert.</p>}
          </>
        ) : (
          <Button onClick={generate} disabled={busy}><QrCode className="h-4 w-4 mr-2" />Offenen Link erstellen</Button>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-3 text-center">
        <Label>QR-Code</Label>
        {qr ? (
          <>
            <img src={qr} alt="QR-Code für den offenen Umfrage-Link" className="mx-auto w-56 h-56 rounded-lg bg-white p-2" />
            <Button variant="outline" className="w-full" asChild>
              <a href={qr} download={`umfrage-qr-${surveyId}.png`}><Download className="h-4 w-4 mr-2" />PNG herunterladen</a>
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Noch kein Link erzeugt.</p>
        )}
      </CardContent></Card>
    </div>
  );
}
