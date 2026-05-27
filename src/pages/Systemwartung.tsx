import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Wrench, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import AccessDenied from './AccessDenied';

export default function Systemwartung() {
  const { hasRole, user } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('system_maintenance')
        .select('enabled, message')
        .eq('id', true)
        .maybeSingle();
      if (!error && data) {
        setEnabled(!!data.enabled);
        setMessage(data.message ?? '');
      }
      setLoading(false);
    })();
  }, []);

  if (!isSuperAdmin) return <AccessDenied />;

  const save = async (nextEnabled: boolean, nextMessage: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('system_maintenance')
      .update({
        enabled: nextEnabled,
        message: nextMessage,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq('id', true);
    setSaving(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({
      title: nextEnabled ? 'Wartungsmodus aktiviert' : 'Wartungsmodus deaktiviert',
      description: nextEnabled
        ? 'Alle Benutzer (außer Super Admin) werden abgemeldet.'
        : 'Das System ist wieder verfügbar.',
    });
    return true;
  };

  const onToggle = async (val: boolean) => {
    const ok = await save(val, message);
    if (ok) setEnabled(val);
  };

  const onSaveMessage = async () => {
    await save(enabled, message);
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Wrench className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Systemwartung</h1>
          <p className="text-muted-foreground text-sm">
            Aktiviert den Wartungsmodus für das gesamte System.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Card className={enabled ? 'border-destructive/60' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${enabled ? 'text-destructive' : 'text-muted-foreground'}`} />
                Wartungsmodus
              </CardTitle>
              <CardDescription>
                Beim Aktivieren werden alle eingeloggten Benutzer (außer Super Admin) automatisch abgemeldet
                und sehen die unten konfigurierte Wartungsnachricht. Neue Anmeldungen sind nicht möglich.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">Wartung aktiv</Label>
                  <p className="text-sm text-muted-foreground">
                    {enabled ? 'System ist im Wartungsmodus.' : 'System läuft normal.'}
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={onToggle} disabled={saving} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="msg">Wartungsnachricht</Label>
                <Textarea
                  id="msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Diese Nachricht wird allen Benutzern angezeigt."
                />
                <div className="flex justify-end">
                  <Button onClick={onSaveMessage} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Nachricht speichern
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
