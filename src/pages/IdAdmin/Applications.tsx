import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';


type App = {
  id: string; app_key: string; app_name: string; description: string | null;
  base_url: string | null; icon_url: string | null;
  redirect_uris: string[] | null; allowed_origins: string[] | null;
  app_status: string; requires_mfa: boolean; session_duration_minutes: number | null;
  sort_order: number | null;
};

export default function IdAdminApplications() {
  const [rows, setRows] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [e2eRunning, setE2eRunning] = useState(false);
  const [e2eResults, setE2eResults] = useState<Array<{ app_key: string; ok: boolean; steps: Array<{ name: string; ok: boolean; detail?: string }> }> | null>(null);

  const runMfaE2e = async () => {
    setE2eRunning(true);
    setE2eResults(null);
    const { data, error } = await supabase.functions.invoke('alix-id-mfa-e2e', { body: {} });
    setE2eRunning(false);
    if (error) { toast.error(`E2E-Test fehlgeschlagen: ${error.message}`); return; }
    setE2eResults(data?.results ?? []);
    toast[data?.ok ? 'success' : 'error'](
      data?.ok ? 'MFA-E2E-Test bestanden für alle Apps.' : 'MFA-E2E-Test hat Fehler gefunden — siehe Details.'
    );
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('alix_applications')
      .select('id, app_key, app_name, description, base_url, icon_url, redirect_uris, allowed_origins, app_status, requires_mfa, session_duration_minutes, sort_order')
      .order('sort_order', { ascending: true });
    setRows((data ?? []) as App[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patch = (id: string, key: keyof App, val: any) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: val } : r));
  };

  const save = async (r: App) => {
    setSavingId(r.id);
    const { error } = await supabase.functions.invoke('alix-id-admin', {
      body: {
        action: 'update_application',
        application_id: r.id,
        patch: {
          app_name: r.app_name, description: r.description, base_url: r.base_url, icon_url: r.icon_url,
          redirect_uris: r.redirect_uris, allowed_origins: r.allowed_origins,
          app_status: r.app_status, requires_mfa: r.requires_mfa,
          session_duration_minutes: r.session_duration_minutes, sort_order: r.sort_order,
        },
      },
    });
    setSavingId(null);
    if (error) toast.error(error.message); else toast.success('Applikation aktualisiert.');
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">MFA-Enforcement E2E-Test</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Prüft für Studio, eAnamnese und Finance: 403 mfa_required → Enrollment → 200 mit Code → Token-Tausch → Reuse-Schutz.
              Legt Testnutzer temporär an und räumt sie danach wieder ab.
            </p>
          </div>
          <Button size="sm" onClick={runMfaE2e} disabled={e2eRunning}>
            {e2eRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PlayCircle className="w-3 h-3 mr-1" />}
            Test starten
          </Button>
        </CardHeader>
        {e2eResults && (
          <CardContent className="space-y-3">
            {e2eResults.map((r) => (
              <div key={r.app_key} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {r.ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-destructive" />}
                  <span className="font-mono">{r.app_key}</span>
                  <Badge variant={r.ok ? 'default' : 'destructive'}>{r.ok ? 'PASS' : 'FAIL'}</Badge>
                </div>
                <ul className="text-xs space-y-0.5 pl-6">
                  {r.steps.map((s, i) => (
                    <li key={i} className={s.ok ? 'text-muted-foreground' : 'text-destructive'}>
                      {s.ok ? '✓' : '✗'} {s.name}{s.detail ? ` — ${s.detail}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {rows.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {r.app_name} <Badge variant="outline" className="font-mono text-xs">{r.app_key}</Badge>
              <Badge variant={r.app_status === 'active' ? 'default' : 'secondary'}>{r.app_status}</Badge>
            </CardTitle>
            <Button size="sm" disabled={savingId === r.id} onClick={() => save(r)}>
              {savingId === r.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
              Speichern
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Name</Label><Input value={r.app_name} onChange={(e) => patch(r.id, 'app_name', e.target.value)} /></div>
            <div><Label>Status</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={r.app_status} onChange={(e) => patch(r.id, 'app_status', e.target.value)}>
                <option value="active">active</option>
                <option value="beta">beta</option>
                <option value="disabled">disabled</option>
                <option value="planned">planned</option>
              </select>
            </div>
            <div className="md:col-span-2"><Label>Beschreibung</Label>
              <Textarea rows={2} value={r.description ?? ''} onChange={(e) => patch(r.id, 'description', e.target.value)} />
            </div>
            <div><Label>Base URL</Label><Input value={r.base_url ?? ''} onChange={(e) => patch(r.id, 'base_url', e.target.value)} /></div>
            <div><Label>Icon URL</Label><Input value={r.icon_url ?? ''} onChange={(e) => patch(r.id, 'icon_url', e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Redirect URIs (eine pro Zeile)</Label>
              <Textarea rows={3} className="font-mono text-xs"
                value={(r.redirect_uris ?? []).join('\n')}
                onChange={(e) => patch(r.id, 'redirect_uris', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} />
            </div>
            <div className="md:col-span-2"><Label>Allowed Origins (eine pro Zeile)</Label>
              <Textarea rows={2} className="font-mono text-xs"
                value={(r.allowed_origins ?? []).join('\n')}
                onChange={(e) => patch(r.id, 'allowed_origins', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={r.requires_mfa} onCheckedChange={(v) => patch(r.id, 'requires_mfa', v)} />
              <Label>MFA erforderlich</Label>
            </div>
            <div><Label>Session (Minuten)</Label>
              <Input type="number" value={r.session_duration_minutes ?? 60} onChange={(e) => patch(r.id, 'session_duration_minutes', Number(e.target.value))} />
            </div>
            <div><Label>Sortierung</Label>
              <Input type="number" value={r.sort_order ?? 0} onChange={(e) => patch(r.id, 'sort_order', Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
