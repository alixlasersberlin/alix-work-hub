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
