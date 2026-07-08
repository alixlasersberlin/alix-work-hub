import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { getChecklistForKind } from '@/lib/esc/workflows/checklists';

export function ChecklistPanel({ kind }: { kind?: string | null }) {
  const tpl = getChecklistForKind(kind);
  const [done, setDone] = useState<Record<string, boolean>>({});
  if (!tpl) return (
    <div className="text-xs text-muted-foreground p-4 border rounded-md">
      Keine Standard-Checkliste für diese Terminart. Wähle z. B. „Service", „Lieferung", „Schulung" oder „Sales".
    </div>
  );
  const total = tpl.items.length;
  const doneCount = Object.values(done).filter(Boolean).length;
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{tpl.label} – Checkliste</div>
        <Badge variant="outline" className="text-[10px]">{doneCount}/{total}</Badge>
      </div>
      {tpl.items.map((i) => (
        <label key={i.id} className="flex items-center gap-2 text-xs">
          <Checkbox checked={!!done[i.id]} onCheckedChange={(v) => setDone({ ...done, [i.id]: !!v })} />
          <span className={done[i.id] ? 'line-through text-muted-foreground' : ''}>{i.label}</span>
          {i.required && <Badge variant="secondary" className="text-[9px]">Pflicht</Badge>}
        </label>
      ))}
    </div>
  );
}
