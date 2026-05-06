import { useEffect, useState } from 'react';
import { Settings, Plus, Trash2, Loader2, Save, Users, Truck, UsersRound, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type ListKey = 'drivers' | 'vehicles' | 'teams' | 'time_windows';

const SETTING_KEY = 'route_planning.parameters';

interface Parameters {
  drivers: string[];
  vehicles: string[];
  teams: string[];
  time_windows: string[];
}

const DEFAULT_PARAMS: Parameters = {
  drivers: [],
  vehicles: [],
  teams: [],
  time_windows: [],
};

const SECTIONS: { key: ListKey; title: string; icon: any; placeholder: string }[] = [
  { key: 'drivers', title: 'Fahrer', icon: Users, placeholder: 'z.B. Max Mustermann' },
  { key: 'vehicles', title: 'Fahrzeuge', icon: Truck, placeholder: 'z.B. Mercedes Sprinter – B-XX 1234' },
  { key: 'teams', title: 'Teams', icon: UsersRound, placeholder: 'z.B. Team Nord' },
  { key: 'time_windows', title: 'Zeitfenster', icon: Clock, placeholder: 'z.B. 08:00 – 12:00' },
];

export default function RoutePlanningSettings() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useState<Parameters>(DEFAULT_PARAMS);
  const [inputs, setInputs] = useState<Record<ListKey, string>>({
    drivers: '', vehicles: '', teams: '', time_windows: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle();
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        setParams({ ...DEFAULT_PARAMS, ...parsed });
      } catch {
        setParams(DEFAULT_PARAMS);
      }
    }
    setLoading(false);
  }

  async function save(next: Parameters) {
    if (!isAdmin) {
      toast({ title: 'Keine Berechtigung', description: 'Nur Admins können Einstellungen speichern.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const value = JSON.stringify(next);
    // Try update first
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', SETTING_KEY)
      .maybeSingle();
    let err;
    if (existing) {
      const r = await supabase.from('app_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', SETTING_KEY);
      err = r.error;
    } else {
      const r = await supabase.from('app_settings').insert({ key: SETTING_KEY, value });
      err = r.error;
    }
    setSaving(false);
    if (err) {
      toast({ title: 'Fehler beim Speichern', description: err.message, variant: 'destructive' });
    } else {
      toast({ title: 'Gespeichert', description: 'Einstellungen wurden aktualisiert.' });
      setParams(next);
    }
  }

  function addItem(key: ListKey) {
    const v = inputs[key].trim();
    if (!v) return;
    if (params[key].includes(v)) {
      toast({ title: 'Eintrag existiert bereits', variant: 'destructive' });
      return;
    }
    const next = { ...params, [key]: [...params[key], v] };
    setInputs({ ...inputs, [key]: '' });
    save(next);
  }

  function removeItem(key: ListKey, val: string) {
    const next = { ...params, [key]: params[key].filter(x => x !== val) };
    save(next);
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Tourenplanung – Einstellungen
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verwalten Sie die einstellbaren Parameter der Tourenplanung (Fahrer, Fahrzeuge, Teams, Zeitfenster).
        </p>
      </div>

      {!isAdmin && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Nur Administratoren können diese Einstellungen ändern.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {SECTIONS.map(({ key, title, icon: Icon, placeholder }) => (
            <div key={key} className="rounded-xl border border-border bg-card card-glow">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                <Icon className="w-4 h-4 text-primary" />
                <h2 className="font-display font-semibold text-foreground text-sm">{title}</h2>
                <span className="ml-auto text-xs text-muted-foreground">{params[key].length} Einträge</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder={placeholder}
                    value={inputs[key]}
                    onChange={(e) => setInputs({ ...inputs, [key]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(key); } }}
                    disabled={!isAdmin || saving}
                  />
                  <Button onClick={() => addItem(key)} disabled={!isAdmin || saving || !inputs[key].trim()} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {params[key].length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">Noch keine Einträge</p>
                ) : (
                  <ul className="space-y-1.5">
                    {params[key].map((item) => (
                      <li key={item} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/50 text-sm">
                        <span className="truncate text-foreground">{item}</span>
                        {isAdmin && (
                          <button
                            onClick={() => removeItem(key, item)}
                            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                            aria-label="Entfernen"
                            disabled={saving}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {saving && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border shadow-lg text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Speichern…
        </div>
      )}
    </div>
  );
}
