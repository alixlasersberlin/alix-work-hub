import { MAPPING_FIELDS, type ColumnMapping } from '@/lib/bank/types';
import { Label } from '@/components/ui/label';

export function ColumnMapper({
  headers, mapping, onChange,
}: { headers: string[]; mapping: ColumnMapping; onChange: (m: ColumnMapping) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {MAPPING_FIELDS.map(f => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs text-muted-foreground">{f.label}</Label>
          <select
            className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={(mapping as any)[f.key] ?? ''}
            onChange={e => onChange({ ...mapping, [f.key]: e.target.value || undefined })}
          >
            <option value="">— nicht zugeordnet —</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

export default ColumnMapper;
