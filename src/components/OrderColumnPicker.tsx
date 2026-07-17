import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Columns3, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';

export type ColumnDef = {
  id: string;
  label: string;
};

type Props = {
  allColumns: ColumnDef[];
  order: string[];
  hidden: string[];
  onChange: (next: { order: string[]; hidden: string[] }) => void;
  onReset: () => void;
};

export function OrderColumnPicker({ allColumns, order, hidden, onChange, onReset }: Props) {
  const byId = useMemo(() => Object.fromEntries(allColumns.map(c => [c.id, c])), [allColumns]);
  // Ensure order contains all known columns (append missing at end)
  const fullOrder = useMemo(() => {
    const known = new Set(allColumns.map(c => c.id));
    const inOrder = order.filter(id => known.has(id));
    const missing = allColumns.map(c => c.id).filter(id => !inOrder.includes(id));
    return [...inOrder, ...missing];
  }, [order, allColumns]);

  const hiddenSet = new Set(hidden);

  const toggle = (id: string) => {
    const next = new Set(hiddenSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange({ order: fullOrder, hidden: [...next] });
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = fullOrder.indexOf(id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= fullOrder.length) return;
    const next = [...fullOrder];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ order: next, hidden: [...hiddenSet] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-secondary border-border">
          <Columns3 className="w-4 h-4" />
          Spalten
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">Spalten anpassen</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onReset}
          >
            <RotateCcw className="w-3 h-3 mr-1" /> Standard
          </Button>
        </div>
        <ul className="space-y-0.5 max-h-80 overflow-y-auto">
          {fullOrder.map((id, idx) => {
            const col = byId[id];
            if (!col) return null;
            const visible = !hiddenSet.has(id);
            return (
              <li key={id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/60">
                <Checkbox checked={visible} onCheckedChange={() => toggle(id)} />
                <span className="flex-1 text-sm">{col.label}</span>
                <button
                  type="button"
                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => move(id, -1)}
                  aria-label="Nach oben"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={idx === fullOrder.length - 1}
                  onClick={() => move(id, 1)}
                  aria-label="Nach unten"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
