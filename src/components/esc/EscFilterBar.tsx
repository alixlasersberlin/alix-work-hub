import { useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ESC_STATUS_LABELS } from './StatusBadge';
import type { EscDepartment, EscEmployee, EscPriority, EscResource, EscStatus } from '@/lib/esc/types';
import { EMPTY_FILTER, EscFilterState, activeFilterCount } from '@/lib/esc/filters';

const PRIORITIES: EscPriority[] = ['low', 'normal', 'high', 'urgent'];

interface Props {
  value: EscFilterState;
  onChange: (v: EscFilterState) => void;
  departments: EscDepartment[];
  employees: EscEmployee[];
  resources: EscResource[];
  kinds?: string[];
}

export function EscFilterBar({ value, onChange, departments, employees, resources, kinds = [] }: Props) {
  const count = activeFilterCount(value);
  const locations = useMemo(
    () => Array.from(new Set([...employees.map((e) => e.location), ...resources.map((r) => r.location)].filter(Boolean))) as string[],
    [employees, resources],
  );

  const toggle = <K extends keyof EscFilterState>(key: K, id: string) => {
    const arr = (value[key] as unknown as string[]) || [];
    const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    onChange({ ...value, [key]: next as any });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <Input
          placeholder="Suche: Titel, Kunde, Adresse, Telefon…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="h-8 w-[260px] pr-7 text-[12.5px]"
        />
        {value.search && (
          <button
            type="button"
            onClick={() => onChange({ ...value, search: '' })}
            className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Suche löschen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1.5">
            <Filter className="w-4 h-4" />
            Filter
            {count > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{count}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[340px] max-h-[70vh] overflow-y-auto space-y-3">
          <FilterGroup title="Abteilung">
            {departments.map((d) => (
              <CheckLine key={d.id} checked={value.departmentIds.includes(d.id)} onChange={() => toggle('departmentIds', d.id)} label={d.name} dot={d.color} />
            ))}
          </FilterGroup>
          <Separator />
          <FilterGroup title="Mitarbeiter">
            {employees.map((e) => (
              <CheckLine key={e.id} checked={value.employeeIds.includes(e.id)} onChange={() => toggle('employeeIds', e.id)} label={e.name} />
            ))}
          </FilterGroup>
          <Separator />
          <FilterGroup title="Ressource">
            {resources.map((r) => (
              <CheckLine key={r.id} checked={value.resourceIds.includes(r.id)} onChange={() => toggle('resourceIds', r.id)} label={r.name} />
            ))}
          </FilterGroup>
          {kinds.length > 0 && (
            <>
              <Separator />
              <FilterGroup title="Terminart">
                {kinds.map((k) => (
                  <CheckLine key={k} checked={value.kinds.includes(k)} onChange={() => toggle('kinds', k)} label={k} />
                ))}
              </FilterGroup>
            </>
          )}
          <Separator />
          <FilterGroup title="Status">
            {(Object.keys(ESC_STATUS_LABELS) as EscStatus[]).map((s) => (
              <CheckLine key={s} checked={value.statuses.includes(s)} onChange={() => toggle('statuses', s)} label={ESC_STATUS_LABELS[s]} />
            ))}
          </FilterGroup>
          <Separator />
          <FilterGroup title="Priorität">
            {PRIORITIES.map((p) => (
              <CheckLine key={p} checked={value.priorities.includes(p)} onChange={() => toggle('priorities', p)} label={p} />
            ))}
          </FilterGroup>
          {locations.length > 0 && (
            <>
              <Separator />
              <FilterGroup title="Standort">
                {locations.map((l) => (
                  <CheckLine key={l} checked={value.locations.includes(l)} onChange={() => toggle('locations', l)} label={l} />
                ))}
              </FilterGroup>
            </>
          )}
          <Separator />
          <FilterGroup title="Kunde">
            <Input
              value={value.customer}
              onChange={(e) => onChange({ ...value, customer: e.target.value })}
              placeholder="Kundenname enthält…"
              className="h-8 text-[12.5px]"
            />
          </FilterGroup>
          <Separator />
          <div className="space-y-1.5">
            <CheckLine checked={value.onlyConfirmed} onChange={() => onChange({ ...value, onlyConfirmed: !value.onlyConfirmed })} label="Nur bestätigte Termine" />
            <CheckLine checked={value.onlyOpenConfirmation} onChange={() => onChange({ ...value, onlyOpenConfirmation: !value.onlyOpenConfirmation })} label="Nur offene Bestätigungen" />
            <CheckLine checked={value.onlyPublicBookings} onChange={() => onChange({ ...value, onlyPublicBookings: !value.onlyPublicBookings })} label="Nur öffentliche Buchungen" />
          </div>
          <div className="flex justify-end pt-2 border-t">
            <Button size="sm" variant="ghost" onClick={() => onChange(EMPTY_FILTER)}>Zurücksetzen</Button>
          </div>
        </PopoverContent>
      </Popover>

      {count > 0 && (
        <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => onChange({ ...EMPTY_FILTER, search: value.search })}>
          <X className="w-3.5 h-3.5 mr-1" /> Filter löschen
        </Button>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CheckLine({ checked, onChange, label, dot }: { checked: boolean; onChange: () => void; label: string; dot?: string }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      {dot && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: dot }} />}
      <span className="truncate">{label}</span>
    </label>
  );
}
