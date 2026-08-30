import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Code2, ListChecks, Sparkles } from 'lucide-react';
import { AiFieldButton } from './AiFieldButton';

export interface SmartKiFeature {
  name: string;
  description?: string;
  enabled?: boolean;
}

interface Props {
  value: any;
  onChange: (next: any) => void;
  disabled?: boolean;
  /** Für KI-Kontext (Gerätedaten) */
  productId?: string;
  productName?: string;
}

/** Vorschläge für typische AlixSmart-Funktionen */
const SUGGESTIONS = [
  'Hauttyp-Erkennung (Fitzpatrick)',
  'Automatische Parameterempfehlung',
  'Behandlungsprotokoll & Verlauf',
  'Geräte-Fernwartung',
  'Sicherheits-Interlock Überwachung',
  'Verbrauchs- & Nutzungsstatistik',
  'Kundenportal-Anbindung',
];

function toFeatures(value: any): SmartKiFeature[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as SmartKiFeature[];
  if (Array.isArray(value.features)) return value.features as SmartKiFeature[];
  // Legacy: { "Feature": true } oder { "Feature": "Beschreibung" }
  if (typeof value === 'object') {
    return Object.entries(value).map(([k, v]) => ({
      name: k,
      description: typeof v === 'string' ? v : '',
      enabled: v !== false,
    }));
  }
  return [];
}

export function SmartKiEditor({ value, onChange, disabled, productId, productName }: Props) {
  const [raw, setRaw] = useState(false);
  const [jsonText, setJsonText] = useState<string>(() => JSON.stringify(value ?? {}, null, 2));
  const features = useMemo(() => toFeatures(value), [value]);
  const notes = (value && !Array.isArray(value) && typeof value === 'object' ? value.notes : '') ?? '';

  const commit = (next: SmartKiFeature[], nextNotes = notes) => {
    onChange({ features: next, ...(nextNotes ? { notes: nextNotes } : {}) });
  };

  const update = (i: number, patch: Partial<SmartKiFeature>) => {
    const next = features.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    commit(next);
  };

  const add = (name = '') => commit([...features, { name, description: '', enabled: true }]);
  const remove = (i: number) => commit(features.filter((_, idx) => idx !== i));

  if (raw) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Smart-KI-Funktionen (JSON)</Label>
          <Button size="sm" variant="ghost" onClick={() => setRaw(false)}>
            <ListChecks className="w-3.5 h-3.5 mr-1" /> Maske
          </Button>
        </div>
        <Textarea
          rows={12}
          disabled={disabled}
          className="font-mono text-xs"
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            try { onChange(JSON.parse(e.target.value || '{}')); } catch { /* live typing */ }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Smart-KI-Funktionen des Geräts
        </Label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setJsonText(JSON.stringify(value ?? {}, null, 2)); setRaw(true); }}
        >
          <Code2 className="w-3.5 h-3.5 mr-1" /> JSON
        </Button>
      </div>

      <div className="space-y-2">
        {features.map((f, i) => (
          <div key={i} className="border border-border rounded-md p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Funktionsname"
                value={f.name ?? ''}
                disabled={disabled}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <Switch
                  checked={f.enabled !== false}
                  disabled={disabled}
                  onCheckedChange={(v) => update(i, { enabled: v })}
                />
                <span className="text-xs text-muted-foreground w-14">
                  {f.enabled !== false ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              <AiFieldButton
                fieldLabel="Name einer Smart-KI-Funktion des Geräts"
                hint="Kurzer, prägnanter Funktionsname (max. 6 Wörter), passend zu bereits vorhandenen Funktionen."
                current={f.name ?? ''}
                maxChars={60}
                productId={productId}
                context={{ productName, vorhandeneFunktionen: features.map(x => x.name).filter(Boolean) }}
                disabled={disabled}
                onGenerated={(t) => update(i, { name: t.replace(/\n/g, ' ').trim() })}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={disabled} onClick={() => remove(i)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            <div className="flex items-start gap-2">
              <Textarea
                rows={2}
                placeholder="Kurzbeschreibung (erscheint auf Website / im Kundenportal)"
                value={f.description ?? ''}
                disabled={disabled}
                onChange={(e) => update(i, { description: e.target.value })}
              />
              <AiFieldButton
                fieldLabel={`Kurzbeschreibung der Smart-KI-Funktion "${f.name || 'unbenannt'}"`}
                hint="1–2 Sätze, kundenverständlich, für Website und Kundenportal."
                current={f.description ?? ''}
                maxChars={280}
                productId={productId}
                context={{ productName, funktion: f.name }}
                disabled={disabled}
                onGenerated={(t) => update(i, { description: t })}
              />
            </div>
          </div>
        ))}
        {features.length === 0 && (
          <div className="text-sm text-muted-foreground">Noch keine Smart-KI-Funktionen hinterlegt.</div>
        )}
      </div>

      <Button size="sm" variant="outline" disabled={disabled} onClick={() => add()}>
        <Plus className="w-4 h-4 mr-1" /> Funktion hinzufügen
      </Button>

      {!disabled && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Vorschläge</div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.filter(s => !features.some(f => f.name === s)).map(s => (
              <Badge key={s} variant="outline" className="cursor-pointer" onClick={() => add(s)}>
                <Plus className="w-3 h-3 mr-1" />{s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Interne Notiz</Label>
        <div className="flex items-start gap-2">
          <Textarea
            rows={2}
            value={notes}
            disabled={disabled}
            onChange={(e) => commit(features, e.target.value)}
          />
          <AiFieldButton
            fieldLabel="Interne Notiz zu den Smart-KI-Funktionen des Geräts"
            hint="Interne Zusammenfassung für Mitarbeiter (nicht kundensichtbar), max. 3 Sätze."
            current={notes}
            maxChars={400}
            productId={productId}
            context={{ productName, funktionen: features }}
            disabled={disabled}
            onGenerated={(t) => commit(features, t)}
          />
        </div>
      </div>
    </div>
  );
}
