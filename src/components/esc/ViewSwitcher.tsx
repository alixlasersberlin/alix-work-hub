import { Button } from '@/components/ui/button';
import type { EscView } from '@/lib/esc/types';
import { cn } from '@/lib/utils';

const VIEWS: { value: EscView | 'timeline'; label: string }[] = [
  { value: 'day', label: 'Tag' },
  { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'department', label: 'Abteilung' },
  { value: 'employee', label: 'Mitarbeiter' },
  { value: 'resource', label: 'Ressource' },
  { value: 'timeline' as EscView, label: 'Timeline' },
];

export function ViewSwitcher({ value, onChange }: { value: EscView | 'timeline'; onChange: (v: EscView | 'timeline') => void }) {
  return (
    <div className="inline-flex items-center rounded-md border bg-card p-0.5 flex-wrap">
      {VIEWS.map((v) => (
        <Button
          key={v.value}
          type="button"
          size="sm"
          variant="ghost"
          className={cn('h-7 px-2 text-[12px]', value === v.value && 'bg-primary/15 text-primary')}
          onClick={() => onChange(v.value)}
        >
          {v.label}
        </Button>
      ))}
    </div>
  );
}
