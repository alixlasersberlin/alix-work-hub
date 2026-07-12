import { useState } from 'react';
import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RmModal } from '@/components/esc/resources/RmModal';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { RmLocation } from '@/lib/esc/resources/types';

const TIMEZONES = [
  'Europe/Berlin', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Riga',
  'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'Asia/Dubai',
  'America/New_York', 'America/Los_Angeles',
];

const empty = (): RmLocation => ({
  id: `loc-${Date.now().toString(36)}`,
  name: '',
  timezone: 'Europe/Berlin',
  country: 'DE',
});

export default function RmLocations() {
  const { locations, upsertLocation, removeLocation } = useResourceMgmt();
  const [editing, setEditing] = useState<RmLocation | null>(null);

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Bitte Name angeben'); return; }
    upsertLocation(editing);
    toast.success('Standort gespeichert');
    setEditing(null);
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Standort „${name}" wirklich löschen?`)) return;
    removeLocation(id);
    toast.success('Standort gelöscht');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Standorte</h1>
          <p className="text-xs text-muted-foreground">
            Standorte werden Mitarbeitern, Fahrzeugen, Räumen und Geräten zugeordnet.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(empty())}>
          <Plus className="h-4 w-4 mr-1" />Neuer Standort
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />Standortverzeichnis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {locations.length === 0 && (
            <div className="text-xs text-muted-foreground">Noch keine Standorte angelegt.</div>
          )}
          {locations.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
              <div>
                <div className="text-sm font-medium">{l.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {l.country || '—'} · {l.timezone}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing({ ...l })}
                  className="p-1.5 rounded hover:bg-muted"
                  aria-label={`${l.name} bearbeiten`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => del(l.id, l.name)}
                  className="p-1.5 rounded hover:bg-muted text-destructive"
                  aria-label={`${l.name} löschen`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <RmModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && locations.some((x) => x.id === editing.id) ? 'Standort bearbeiten' : 'Neuer Standort'}
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Abbrechen</Button>
          <Button size="sm" onClick={save}>Speichern</Button>
        </>}
      >
        {editing && (
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="z. B. Berlin"
              />
            </div>
            <div>
              <Label>Land (ISO-Code)</Label>
              <Input
                value={editing.country || ''}
                maxLength={3}
                onChange={(e) => setEditing({ ...editing, country: e.target.value.toUpperCase() })}
                placeholder="DE"
              />
            </div>
            <div>
              <Label>Zeitzone</Label>
              <select
                className="w-full h-9 px-2 rounded border bg-background"
                value={editing.timezone}
                onChange={(e) => setEditing({ ...editing, timezone: e.target.value })}
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
        )}
      </RmModal>
    </div>
  );
}
