import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Siren, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type App = { id: string; app_key: string; app_name: string; app_status: string };

export default function IdAdminEmergencyLock() {
  const [apps, setApps] = useState<App[]>([]);
  const [appId, setAppId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('alix_applications').select('id, app_key, app_name, app_status').order('sort_order');
      setApps((data ?? []) as App[]);
    })();
  }, []);

  const disableApp = async () => {
    if (!appId) { toast.error('Applikation wählen.'); return; }
    if (!confirm('Applikation wirklich sofort deaktivieren? Alle neuen SSO-Anfragen werden abgelehnt.')) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke('alix-id-admin', {
      body: { action: 'update_application', application_id: appId, patch: { app_status: 'disabled' } },
    });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success('Applikation deaktiviert.');
  };

  const reactivate = async () => {
    if (!appId) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke('alix-id-admin', {
      body: { action: 'update_application', application_id: appId, patch: { app_status: 'active' } },
    });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success('Applikation reaktiviert.');
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Alert variant="destructive">
        <Siren className="w-4 h-4" />
        <AlertTitle>Notfall-Bereich</AlertTitle>
        <AlertDescription>
          Aktionen hier sind sofort wirksam und werden im Security-Log dokumentiert.
          Nur im Ernstfall verwenden (kompromittierte App, Vorfallreaktion).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle className="text-base">Applikation deaktivieren / freigeben</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Applikation</Label>
            <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={appId} onChange={(e) => setAppId(e.target.value)}>
              <option value="">— wählen —</option>
              {apps.map(a => <option key={a.id} value={a.id}>{a.app_name} · {a.app_status}</option>)}
            </select>
          </div>
          <div>
            <Label>Begründung (im Log gespeichert)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z.B. Kompromittierte Redirect-URI, Vorfall #123 …" />
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={disableApp} disabled={busy || !appId}>
              {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Siren className="w-3 h-3 mr-1" />}
              Sofort deaktivieren
            </Button>
            <Button variant="outline" onClick={reactivate} disabled={busy || !appId}>
              Wieder freigeben
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
