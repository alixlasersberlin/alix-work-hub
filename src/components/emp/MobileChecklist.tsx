import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

export interface ChecklistItem { id: string; label: string; done: boolean; note?: string; }

interface Props {
  initial?: ChecklistItem[];
  onChange?: (items: ChecklistItem[]) => void;
}

const DEFAULTS: ChecklistItem[] = [
  { id: '1', label: 'Sichtprüfung Gerät', done: false },
  { id: '2', label: 'Funktionstest durchgeführt', done: false },
  { id: '3', label: 'Kunde eingewiesen', done: false },
  { id: '4', label: 'Servicebericht erstellt', done: false },
];

export default function MobileChecklist({ initial = DEFAULTS, onChange }: Props) {
  const [items, setItems] = useState(initial);
  const update = (next: ChecklistItem[]) => { setItems(next); onChange?.(next); };

  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.id} className="rounded-lg border border-border p-3 space-y-2">
          <label className="flex items-start gap-3">
            <Checkbox
              checked={it.done}
              onCheckedChange={(v) => update(items.map(x => x.id === it.id ? { ...x, done: !!v } : x))}
              className="mt-0.5"
            />
            <span className="text-sm font-medium">{it.label}</span>
          </label>
          <Textarea
            placeholder="Kommentar (optional)"
            value={it.note ?? ''}
            onChange={(e) => update(items.map(x => x.id === it.id ? { ...x, note: e.target.value } : x))}
            className="min-h-[52px] text-sm"
          />
        </li>
      ))}
    </ul>
  );
}
