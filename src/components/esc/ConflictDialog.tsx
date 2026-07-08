import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { EscConflict } from '@/lib/esc/conflicts';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  conflicts: EscConflict[];
  onCancel: () => void;
  onOverride: () => void;
  onAlternative?: () => void;
  canOverride: boolean;
}

export function ConflictDialog({ open, conflicts, onCancel, onOverride, onAlternative, canOverride }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" /> Konflikt erkannt
          </DialogTitle>
          <DialogDescription>
            Der Termin überschneidet sich mit bereits geplanten Einträgen.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-[13px] max-h-[40vh] overflow-y-auto">
          {conflicts.map((c, i) => (
            <li key={i} className="rounded-md border p-2 bg-muted/30">
              <div className="font-medium">
                {c.kind === 'employee' ? 'Mitarbeiter bereits gebucht' : c.kind === 'resource' ? 'Ressource bereits belegt' : 'Abteilungskonflikt'}
                {': '}<span className="text-primary">{c.refLabel}</span>
              </div>
              <div className="text-muted-foreground">
                {c.otherAppointment.title} · {format(new Date(c.otherAppointment.startAt), 'dd.MM. HH:mm')}–{format(new Date(c.otherAppointment.endAt), 'HH:mm')}
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>Abbrechen</Button>
          {onAlternative && <Button variant="outline" onClick={onAlternative}>Alternative suchen</Button>}
          <Button variant="destructive" onClick={onOverride} disabled={!canOverride} title={canOverride ? '' : 'Keine Berechtigung zum Übersteuern'}>
            Trotzdem speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
