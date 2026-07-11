import { DispatchBoard } from '@/components/esc/resources/DispatchBoard';
import { RmQuickActions } from '@/components/esc/resources/RmQuickActions';
import { useAppointments } from '@/hooks/esc/useAppointments';

export default function RmDispatch() {
  const { appointments } = useAppointments();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Einsatzplanung · Disposition</h1>
        <p className="text-xs text-muted-foreground">
          Termine per Drag &amp; Drop auf Mitarbeiter, Fahrzeuge, Räume oder Vorführgeräte ziehen. Konflikte, Qualifikationen und Standorte werden automatisch geprüft.
        </p>
      </div>
      <RmQuickActions />
      <DispatchBoard appointments={appointments} />
    </div>
  );
}
