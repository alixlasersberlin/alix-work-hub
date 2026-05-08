import { Car, Loader2, AlertCircle } from 'lucide-react';

interface DrivingResult {
  duration_text: string;
  duration_seconds: number;
  distance_text: string;
}

interface Props {
  value: DrivingResult | null | undefined;
  requested: boolean;
  loading: boolean;
}

/**
 * Driving time cell with status:
 * - berechnet: value present
 * - ausstehend: not yet requested OR currently loading and no result yet
 * - fehlgeschlagen: was requested but result is explicitly null (geocode/matrix failure)
 */
export function DrivingTimeCell({ value, requested, loading }: Props) {
  if (value) {
    return (
      <span
        className="inline-flex items-center gap-1 text-foreground"
        title="Fahrzeit berechnet"
      >
        <Car className="w-3 h-3 text-primary" />
        {value.duration_text} ({value.distance_text})
      </span>
    );
  }

  // Explicit failure: requested, not loading, but result is null
  if (requested && !loading && value === null) {
    return (
      <span
        className="inline-flex items-center gap-1 text-destructive"
        title="Fahrzeit konnte nicht berechnet werden (Adresse nicht geocodierbar)"
      >
        <AlertCircle className="w-3 h-3" />
        fehlgeschlagen
      </span>
    );
  }

  // Pending: either not requested yet or still loading
  return (
    <span
      className="inline-flex items-center gap-1 text-muted-foreground"
      title="Fahrzeit wird berechnet"
    >
      <Loader2 className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
      ausstehend
    </span>
  );
}
