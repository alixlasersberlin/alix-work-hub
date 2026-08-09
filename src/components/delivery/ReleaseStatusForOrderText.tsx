import { useEffect, useState } from 'react';
import { ReleaseStatusDot } from './ReleaseStatusDot';
import { useReleaseRealtime } from './useReleaseRealtime';
import { fetchReleaseStatusByOrderNumbers } from '@/lib/delivery-approval/api';
import type { OverallStatus } from '@/lib/delivery-approval/config';

/** Extrahiert Auftragsnummern (Format 2026-07405) aus freiem Text. */
export function extractOrderNumbers(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const m of String(t).matchAll(/\b(20\d{2}-\d{4,6})\b/g)) found.add(m[1]);
  }
  return [...found];
}

/**
 * Zeigt die Freigabe-Ampel für Aufträge, deren Nummern in den übergebenen Texten
 * (Titel/Beschreibung eines Termins) vorkommen. Rendert nichts ohne Treffer.
 */
export function ReleaseStatusForOrderText({
  texts,
  withLabel = true,
}: { texts: (string | null | undefined)[]; withLabel?: boolean }) {
  const numbers = extractOrderNumbers(...texts);
  const key = numbers.join(',');
  const [map, setMap] = useState<Record<string, OverallStatus>>({});
  const tick = useReleaseRealtime();

  useEffect(() => {
    const nums = key ? key.split(',') : [];
    if (!nums.length) { setMap({}); return; }
    let cancelled = false;
    void fetchReleaseStatusByOrderNumbers(nums)
      .then((m) => { if (!cancelled) setMap(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [key, tick]);

  if (!numbers.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {numbers.map((n) => (
        <span key={n} className="inline-flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">{n}</span>
          <ReleaseStatusDot status={map[n]} withLabel={withLabel} />
        </span>
      ))}
    </div>
  );
}

export default ReleaseStatusForOrderText;
