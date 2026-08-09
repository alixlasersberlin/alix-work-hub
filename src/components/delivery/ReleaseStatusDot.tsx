import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { OVERALL_UI } from '@/lib/delivery-approval/config';
import { fetchReleaseStatusMap } from '@/lib/delivery-approval/api';

type Status = keyof typeof OVERALL_UI;

/** Ampel für den Auslieferungs-Freigabestatus eines Auftrags. */
export function ReleaseStatusDot({ status, withLabel = false }: { status?: Status | null; withLabel?: boolean }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Freigabeprozess nicht gestartet">
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
        {withLabel && 'keine Freigabe'}
      </span>
    );
  }
  const ui = OVERALL_UI[status];
  return withLabel ? (
    <Badge variant="outline" className={ui.text} title={`Auslieferungsfreigabe: ${ui.label}`}>
      <span className={`mr-1 inline-block h-2 w-2 rounded-full ${ui.dot}`} />{ui.label}
    </Badge>
  ) : (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${ui.dot}`} title={`Auslieferungsfreigabe: ${ui.label}`} />
  );
}

/** Lädt die Freigabestatus für eine Liste von Auftrags-IDs. */
export function useReleaseStatusMap(orderIds: string[]) {
  const [map, setMap] = useState<Record<string, Status>>({});
  const key = orderIds.filter(Boolean).sort().join(',');
  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) { setMap({}); return; }
    let cancelled = false;
    void fetchReleaseStatusMap(ids)
      .then((m) => { if (!cancelled) setMap(m as Record<string, Status>); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [key]);
  return map;
}

export default ReleaseStatusDot;
