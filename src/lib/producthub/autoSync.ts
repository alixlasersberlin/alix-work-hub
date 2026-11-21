export const DIRECT_CHANNELS = ['com', 'de', 'beautyco', 'dubai'] as const;
export type DirectChannel = typeof DIRECT_CHANNELS[number];

/** Direkt angeschlossene, aktive Webseiten, die nach einem Super-Admin-Speichern den aktuellen Stand erhalten. US nie. */
export function autoSyncTargets(selected: (code: string) => boolean, sites: { code: string; is_active?: boolean }[]): DirectChannel[] {
  return sites
    .filter(s => s.is_active !== false && (DIRECT_CHANNELS as readonly string[]).includes(s.code) && selected(s.code))
    .map(s => s.code as DirectChannel);
}
