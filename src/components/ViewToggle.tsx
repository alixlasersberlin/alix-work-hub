import { LayoutGrid, List as ListIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/hooks/useViewMode';

interface Props {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: Props) {
  return (
    <div
      role="group"
      aria-label="Ansicht umschalten"
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-secondary p-0.5",
        className
      )}
    >
      <Button
        type="button"
        variant={value === 'rows' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2.5 gap-1.5"
        onClick={() => onChange('rows')}
        aria-pressed={value === 'rows'}
        title="Zeilen-Ansicht"
      >
        <ListIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-xs">Zeilen</span>
      </Button>
      <Button
        type="button"
        variant={value === 'cards' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2.5 gap-1.5"
        onClick={() => onChange('cards')}
        aria-pressed={value === 'cards'}
        title="Kachel-Ansicht"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-xs">Kacheln</span>
      </Button>
    </div>
  );
}
