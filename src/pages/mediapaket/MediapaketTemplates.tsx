// Phase 32 — Mediapaket-Vorlagen: Verwaltung in app_settings JSON
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, Save, Plus, Trash2, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const KEY = 'mediapaket.templates';

interface Template {
  id: string;
  name: string;
  description: string;
  target: 'small' | 'chain' | 'franchise' | 'other';
  defaults: {
    studio_name?: string;
    services?: string[];
    treatments?: string[];
    devices?: string[];
    branding_notes?: string;
  };
}

const EMPTY: Template = { id: '', name: '', description: '', target: 'small', defaults: {} };

export default function MediapaketTemplates() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Template>(EMPTY);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle();
      try {
        const raw = (data as any)?.value;
        const parsed = raw ? JSON.parse(raw) : [];
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch { setItems([]); }
      setLoading(false);
    })();
  }, []);

  const persist = async (next: Template[]) => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase.from('app_settings') as any).upsert(
      { key: KEY, value: JSON.stringify(next), updated_by: userData.user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    setItems(next);
    return true;
  };

  const add = async () => {
    if (!draft.name.trim()) { toast.error('Name fehlt'); return; }
    const t: Template = { ...draft, id: draft.id || crypto.randomUUID() };
    if (await persist([...items.filter(i => i.id !== t.id), t])) {
      toast.success('Vorlage gespeichert');
      setDraft(EMPTY);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Vorlage löschen?')) return;
    if (await persist(items.filter(i => i.id !== id))) toast.success('Gelöscht');
  };

  const edit = (t: Template) => setDraft(t);

  const setCsv = (key: keyof Template['defaults'], value: string) => {
    setDraft(d => ({ ...d, defaults: { ...d.defaults, [key]: value.split(',').map(s => s.trim()).filter(Boolean) } }));
  };

  if (!isSuperAdmin) return <div className="p-8 text-center text-muted-foreground">Nur Super Admin.</div>;
  if (loading) return <div className="p-8 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <LayoutTemplate className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold">Mediapaket-Vorlagen</h1>
        <Badge variant="outline">Phase 32</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Vorlagen ermöglichen Ein-Klick-Erstellung neuer Mediapakete mit vordefinierten Angaben. Ideal für wiederkehrende Studio-Typen.
      </p>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold">{draft.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="z.B. Klein-Studio Standard" />
          </div>
          <div>
            <Label className="text-xs">Zielgruppe</Label>
            <select
              value={draft.target}
              onChange={e => setDraft({ ...draft, target: e.target.value as any })}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="small">Klein-Studio</option>
              <option value="chain">Kette</option>
              <option value="franchise">Franchise</option>
              <option value="other">Sonstiges</option>
            </select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Beschreibung</Label>
          <Textarea rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Services (Komma)</Label>
            <Input value={draft.defaults.services?.join(', ') ?? ''} onChange={e => setCsv('services', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Behandlungen (Komma)</Label>
            <Input value={draft.defaults.treatments?.join(', ') ?? ''} onChange={e => setCsv('treatments', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Geräte (Komma)</Label>
            <Input value={draft.defaults.devices?.join(', ') ?? ''} onChange={e => setCsv('devices', e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Branding-Notizen</Label>
          <Textarea rows={2} value={draft.defaults.branding_notes ?? ''} onChange={e => setDraft({ ...draft, defaults: { ...draft.defaults, branding_notes: e.target.value } })} />
        </div>
        <div className="flex justify-end gap-2">
          {draft.id && <Button variant="outline" onClick={() => setDraft(EMPTY)}>Abbrechen</Button>}
          <Button onClick={add} disabled={saving} className="gold-gradient text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {draft.id ? 'Speichern' : <><Plus className="w-4 h-4 mr-1" />Anlegen</>}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Vorhandene Vorlagen ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Noch keine Vorlagen. Lege oben die erste an.</p>
        ) : (
          <div className="space-y-2">
            {items.map(t => (
              <div key={t.id} className="flex items-start justify-between gap-3 border border-border/50 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">{t.target}</Badge>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(t.defaults.services || []).slice(0, 4).map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => edit(t)}>Bearbeiten</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
