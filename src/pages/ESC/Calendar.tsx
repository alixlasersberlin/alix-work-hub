import { useMemo, useState } from 'react';
import { addDays, addMonths, addWeeks, format, subDays, subMonths, subWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { ViewSwitcher } from '@/components/esc/ViewSwitcher';
import { DayView } from '@/components/esc/views/DayView';
import { WeekView } from '@/components/esc/views/WeekView';
import { MonthView } from '@/components/esc/views/MonthView';
import { AgendaView } from '@/components/esc/views/AgendaView';
import { DepartmentView } from '@/components/esc/views/DepartmentView';
import { EmployeeView } from '@/components/esc/views/EmployeeView';
import { ResourceView } from '@/components/esc/views/ResourceView';
import { AppointmentModal } from '@/components/esc/AppointmentModal';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { useEmployees } from '@/hooks/esc/useEmployees';
import { useResources } from '@/hooks/esc/useResources';
import type { EscAppointment, EscView } from '@/lib/esc/types';
import { toast } from 'sonner';

export default function EscCalendar() {
  const [view, setView] = useState<EscView>('week');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EscAppointment | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();

  const { appointments, createAppointment, updateAppointment, deleteAppointment } = useAppointments();
  const { departments } = useDepartments();
  const { employees } = useEmployees();
  const { resources } = useResources();

  const title = useMemo(() => {
    if (view === 'day') return format(cursor, 'EEEE, dd. MMMM yyyy', { locale: de });
    if (view === 'week') return `KW ${format(cursor, 'I', { locale: de })} · ${format(cursor, 'MMMM yyyy', { locale: de })}`;
    if (view === 'month') return format(cursor, 'MMMM yyyy', { locale: de });
    return 'Alle Termine';
  }, [view, cursor]);

  const navigate = (dir: -1 | 1) => {
    if (view === 'day') setCursor((c) => (dir === 1 ? addDays(c, 1) : subDays(c, 1)));
    else if (view === 'week') setCursor((c) => (dir === 1 ? addWeeks(c, 1) : subWeeks(c, 1)));
    else if (view === 'month') setCursor((c) => (dir === 1 ? addMonths(c, 1) : subMonths(c, 1)));
  };

  const openNew = (start?: Date) => { setEditing(null); setDefaultStart(start); setModalOpen(true); };
  const openEdit = (a: EscAppointment) => { setEditing(a); setDefaultStart(undefined); setModalOpen(true); };

  const handleSubmit = async (payload: Omit<EscAppointment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      await updateAppointment(editing.id, payload);
      toast.success('Termin aktualisiert');
    } else {
      await createAppointment(payload);
      toast.success('Termin angelegt');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <Button size="icon" variant="outline" onClick={() => navigate(1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}><CalendarDays className="w-4 h-4 mr-1" />Heute</Button>
        </div>
        <div className="text-[13px] font-medium">{title}</div>
        <div className="ml-auto flex items-center gap-2">
          <ViewSwitcher value={view} onChange={setView} />
          <Button size="sm" onClick={() => openNew()}>
            <Plus className="w-4 h-4 mr-1" /> Neuer Termin
          </Button>
        </div>
      </div>

      {view === 'day' && <DayView date={cursor} appointments={appointments} departments={departments} onSlotClick={openNew} onAppointmentClick={openEdit} />}
      {view === 'week' && <WeekView date={cursor} appointments={appointments} departments={departments} onSlotClick={openNew} onAppointmentClick={openEdit} />}
      {view === 'month' && <MonthView date={cursor} appointments={appointments} departments={departments} onDayClick={(d) => openNew(new Date(d.setHours(9,0,0,0)))} onAppointmentClick={openEdit} />}
      {view === 'agenda' && <AgendaView appointments={appointments} departments={departments} onAppointmentClick={openEdit} />}
      {view === 'department' && <DepartmentView appointments={appointments} departments={departments} onAppointmentClick={openEdit} />}
      {view === 'employee' && <EmployeeView appointments={appointments} employees={employees} departments={departments} onAppointmentClick={openEdit} />}
      {view === 'resource' && <ResourceView appointments={appointments} resources={resources} departments={departments} onAppointmentClick={openEdit} />}

      <AppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        departments={departments}
        employees={employees}
        initial={editing || undefined}
        defaultStart={defaultStart}
      />

      {editing && (
        <div className="text-right">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => { await deleteAppointment(editing.id); setEditing(null); toast.success('Termin gelöscht'); }}>
            Termin löschen
          </Button>
        </div>
      )}
    </div>
  );
}
