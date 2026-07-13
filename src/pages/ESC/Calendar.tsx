import { useMemo, useState } from 'react';
import { addDays, addMonths, addWeeks, differenceInMinutes, format, subDays, subMonths, subWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Bell, ClipboardList, Users } from 'lucide-react';
import { ViewSwitcher } from '@/components/esc/ViewSwitcher';
import { DayView } from '@/components/esc/views/DayView';
import { WeekView } from '@/components/esc/views/WeekView';
import { MonthView } from '@/components/esc/views/MonthView';
import { AgendaView } from '@/components/esc/views/AgendaView';
import { DepartmentView } from '@/components/esc/views/DepartmentView';
import { EmployeeView } from '@/components/esc/views/EmployeeView';
import { ResourceView } from '@/components/esc/views/ResourceView';
import { TimelineView } from '@/components/esc/views/TimelineView';
import { AppointmentModalTabs } from '@/components/esc/AppointmentModalTabs';
import { EscFilterBar } from '@/components/esc/EscFilterBar';
import { ConflictDialog } from '@/components/esc/ConflictDialog';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { useEmployees } from '@/hooks/esc/useEmployees';
import { useResources } from '@/hooks/esc/useResources';
import type { EscAppointment, EscView } from '@/lib/esc/types';
import { toast } from 'sonner';
import { EMPTY_FILTER, applyFilters, EscFilterState } from '@/lib/esc/filters';
import { findConflicts, EscConflict } from '@/lib/esc/conflicts';
import { useAuth } from '@/hooks/useAuth';
import { canEditForeignAppointments } from '@/lib/esc/permissions';

type ViewValue = EscView | 'timeline';

export default function EscCalendar() {
  const { roles, hasRole } = useAuth();
  const canOverride = canEditForeignAppointments(roles);
  const canCreate = hasRole('Super Admin');
  const canSeeInternal = roles.length > 0; // adjust as needed

  const [view, setView] = useState<ViewValue>('week');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EscAppointment | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [presetKind, setPresetKind] = useState<'Erinnerung' | 'Wiedervorlage' | undefined>();
  const [presetMode, setPresetMode] = useState<'intern' | 'extern' | undefined>();
  const [filters, setFilters] = useState<EscFilterState>(EMPTY_FILTER);

  const { appointments, createAppointment, updateAppointment, deleteAppointment } = useAppointments();
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { resources } = useResources();

  const kinds = useMemo(() => Array.from(new Set(appointments.map((a) => a.kind).filter(Boolean))) as string[], [appointments]);
  const filtered = useMemo(() => applyFilters(appointments, filters, canSeeInternal), [appointments, filters, canSeeInternal]);

  const [pendingMove, setPendingMove] = useState<{ id: string; newStart: Date; conflicts: EscConflict[] } | null>(null);

  const title = useMemo(() => {
    if (view === 'day' || view === 'timeline') return format(cursor, 'EEEE, dd. MMMM yyyy', { locale: de });
    if (view === 'week') return `KW ${format(cursor, 'I', { locale: de })} · ${format(cursor, 'MMMM yyyy', { locale: de })}`;
    if (view === 'month') return format(cursor, 'MMMM yyyy', { locale: de });
    return 'Alle Termine';
  }, [view, cursor]);

  const navigate = (dir: -1 | 1) => {
    if (view === 'day' || view === 'timeline') setCursor((c) => (dir === 1 ? addDays(c, 1) : subDays(c, 1)));
    else if (view === 'week') setCursor((c) => (dir === 1 ? addWeeks(c, 1) : subWeeks(c, 1)));
    else if (view === 'month') setCursor((c) => (dir === 1 ? addMonths(c, 1) : subMonths(c, 1)));
  };

  const openNew = (start?: Date, mode: 'intern' | 'extern' = 'intern') => {
    if (!canCreate) { toast.error('Neue Termine dürfen ausschließlich vom Super Admin angelegt werden.'); return; }
    setEditing(null); setDefaultStart(start); setPresetKind(undefined); setPresetMode(mode); setModalOpen(true);
  };
  const openNewKind = (kind: 'Erinnerung' | 'Wiedervorlage') => {
    if (!canCreate) { toast.error('Neue Termine dürfen ausschließlich vom Super Admin angelegt werden.'); return; }
    setEditing(null); setDefaultStart(undefined); setPresetKind(kind); setPresetMode(undefined); setModalOpen(true);
  };
  const openEdit = (a: EscAppointment) => {
    setEditing(a); setDefaultStart(undefined); setPresetKind(undefined); setPresetMode(undefined); setModalOpen(true);
  };

  const handleSubmit = async (payload: Omit<EscAppointment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      await updateAppointment(editing.id, payload);
      toast.success('Termin aktualisiert');
    } else {
      await createAppointment(payload);
      toast.success('Termin angelegt');
    }
  };

  const performMove = async (id: string, newStart: Date) => {
    const a = appointments.find((x) => x.id === id);
    if (!a) return;
    const dur = differenceInMinutes(new Date(a.endAt), new Date(a.startAt));
    const newEnd = new Date(newStart.getTime() + dur * 60_000);
    await updateAppointment(id, { startAt: newStart.toISOString(), endAt: newEnd.toISOString() });
    toast.success('Termin verschoben');
  };

  const handleDrop = async (id: string, newStart: Date) => {
    const a = appointments.find((x) => x.id === id);
    if (!a) return;
    const dur = differenceInMinutes(new Date(a.endAt), new Date(a.startAt));
    const draft = {
      ...a,
      startAt: newStart.toISOString(),
      endAt: new Date(newStart.getTime() + dur * 60_000).toISOString(),
    };
    const conflicts = findConflicts(draft, appointments, {
      employees: employees.map((e) => ({ id: e.id, name: e.name })),
      resources: resources.map((r) => ({ id: r.id, name: r.name })),
    });
    if (conflicts.length) {
      setPendingMove({ id, newStart, conflicts });
      return;
    }
    performMove(id, newStart);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft className="w-4 h-4" /></Button>
          <Button size="icon" variant="outline" onClick={() => navigate(1)} aria-label="Weiter"><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}><CalendarDays className="w-4 h-4 mr-1" />Heute</Button>
        </div>
        <div className="text-[13px] font-medium">{title}</div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Select
            value={filters.employeeIds[0] ?? '__all'}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, employeeIds: v === '__all' ? [] : [v] }))
            }
          >
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <Users className="w-3.5 h-3.5 mr-1.5 opacity-70" />
              <SelectValue placeholder="Mitarbeiter" />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="__all">
                Alle Mitarbeiter ({appointments.length})
              </SelectItem>
              {employees
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((e) => {
                  const count = appointments.filter((a) => a.employeeIds?.includes(e.id)).length;
                  return (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({count})
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
          <ViewSwitcher value={view} onChange={setView} />
          {canCreate && (
            <>
              <Button size="sm" variant="outline" onClick={() => openNewKind('Erinnerung')} title="Interne Erinnerung anlegen">
                <Bell className="w-4 h-4 mr-1" /> Erinnerung
              </Button>
              <Button size="sm" variant="outline" onClick={() => openNewKind('Wiedervorlage')} title="Interne Wiedervorlage anlegen">
                <ClipboardList className="w-4 h-4 mr-1" /> Wiedervorlage
              </Button>
              <Button size="sm" variant="outline" onClick={() => openNew(undefined, 'intern')} title="Interner Termin (nur Team)">
                <Plus className="w-4 h-4 mr-1" /> Neuer Termin (intern)
              </Button>
              <Button size="sm" onClick={() => openNew(undefined, 'extern')} title="Externer Termin mit Kunde/Partner">
                <Plus className="w-4 h-4 mr-1" /> Neuer Termin (extern)
              </Button>
            </>
          )}
        </div>
      </div>

      <EscFilterBar value={filters} onChange={setFilters} departments={departments} employees={employees} resources={resources} kinds={kinds} />

      {view === 'day' && <DayView date={cursor} appointments={filtered} departments={departments} onSlotClick={openNew} onAppointmentClick={openEdit} onDropAppointment={handleDrop} />}
      {view === 'week' && <WeekView date={cursor} appointments={filtered} departments={departments} onSlotClick={openNew} onAppointmentClick={openEdit} onDropAppointment={handleDrop} />}
      {view === 'month' && <MonthView date={cursor} appointments={filtered} departments={departments} onDayClick={(d) => openNew(new Date(d.setHours(9,0,0,0)))} onAppointmentClick={openEdit} />}
      {view === 'agenda' && <AgendaView appointments={filtered} departments={departments} onAppointmentClick={openEdit} />}
      {view === 'department' && <DepartmentView appointments={filtered} departments={departments} onAppointmentClick={openEdit} />}
      {view === 'employee' && <EmployeeView appointments={filtered} employees={employees} departments={departments} onAppointmentClick={openEdit} />}
      {view === 'resource' && <ResourceView appointments={filtered} resources={resources} departments={departments} onAppointmentClick={openEdit} />}
      {view === 'timeline' && <TimelineView date={cursor} appointments={filtered} departments={departments} employees={employees} onAppointmentClick={openEdit} />}

      <AppointmentModalTabs
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
        onCancelAppointment={async (id) => { await updateAppointment(id, { status: 'storniert' }); toast.success('Termin storniert'); }}
        onComplete={async (id) => { await updateAppointment(id, { status: 'abgeschlossen' }); toast.success('Termin abgeschlossen'); }}
        onDelete={async (id) => { if (!confirm('Termin wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return; await deleteAppointment(id); }}
        departments={departments}
        employees={employees}
        resources={resources}
        initial={
          editing
            || (presetKind ? { kind: presetKind } as Partial<EscAppointment> : undefined)
            || (presetMode === 'extern' ? { confirmationRequired: true } as Partial<EscAppointment> : undefined)
        }
        defaultStart={defaultStart}
        canSeeInternal={canSeeInternal}
      />

      <ConflictDialog
        open={!!pendingMove}
        conflicts={pendingMove?.conflicts || []}
        onCancel={() => setPendingMove(null)}
        onOverride={async () => { if (pendingMove) { await performMove(pendingMove.id, pendingMove.newStart); setPendingMove(null); } }}
        canOverride={canOverride}
      />
    </div>
  );
}
