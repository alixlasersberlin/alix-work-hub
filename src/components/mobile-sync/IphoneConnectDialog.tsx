import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Smartphone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { CARDDAV_SERVER_HOST, CARDDAV_PATH, createDeviceToken } from '@/lib/mobile-sync';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
  userId?: string;
  onCreated?: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border bg-muted/30 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-mono text-[13px] break-all">{value}</div>
      </div>
      <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(value); toast.success('Kopiert'); }}>
        <Copy className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function IphoneConnectDialog({ open, onOpenChange, email, userId, onCreated }: Props) {
  const [deviceName, setDeviceName] = useState('iPhone');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await createDeviceToken(deviceName || 'iPhone', userId);
      setToken(res.token);
      onCreated?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setToken(null); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> iPhone verbinden</DialogTitle>
          <DialogDescription>
            AlixWork-Kunden erscheinen danach in der Apple Kontakte-App in der eigenen Liste „ALIXWORK“.
          </DialogDescription>
        </DialogHeader>

        {!token ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Gerätename</Label>
              <Input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="iPhone von Ronny" />
            </div>
            <Alert>
              <ShieldCheck className="w-4 h-4" />
              <AlertDescription className="text-[12px]">
                Es wird ein persönliches Token erzeugt. Es wird nur einmal angezeigt und kann jederzeit widerrufen werden.
                Ihr AlixWork-Passwort wird nicht auf dem Gerät gespeichert.
              </AlertDescription>
            </Alert>
            <Button className="w-full" onClick={generate} disabled={busy}>
              {busy ? 'Wird erzeugt…' : 'Persönlichen Zugang erzeugen'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Alert>
              <AlertDescription className="text-[12px]">
                Token jetzt notieren – es wird nicht erneut angezeigt.
              </AlertDescription>
            </Alert>
            <Row label="Server (genau so eintragen)" value={CARDDAV_SERVER_FIELD} />
            <Row label="Benutzername" value={email} />
            <Row label="Passwort / Token" value={token} />

            <div className="rounded border border-border p-3 text-[12px] space-y-1.5">
              <div className="font-semibold">Einrichtung auf dem iPhone</div>
              <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                <li>Einstellungen → Apps → Kontakte → Kontakte-Accounts → Account hinzufügen</li>
                <li>„Andere“ → „CardDAV-Account hinzufügen“</li>
                <li>Server: <span className="font-mono">{CARDDAV_SERVER_FIELD}</span> — <b>inklusive Pfad</b>, nur der Hostname allein funktioniert nicht</li>
                <li>Benutzername = AlixWork-E-Mail, Passwort = Token oben, Beschreibung: <b>ALIXWORK</b></li>
                <li>Kontakte-App → Listen → nur „ALIXWORK“ prüfen; private iCloud-Kontakte bleiben unverändert</li>
              </ol>
            </div>
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>Fertig</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
