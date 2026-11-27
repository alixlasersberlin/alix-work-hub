import { channelAllowed, type OperatingGate } from '../_shared/ph-operating-mode.ts';

/** Bulk contract version; existing routes keep their unchanged responses. */
export const BUNDLE_CONTRACT = '1.2';
const GOVERNED = ['de', 'com'];

export type SyncScope =
  | { governed: false }
  | { governed: true; mode: 'blocked' | 'pilot' | 'full'; emergency_stopped: boolean; pilot_product_id: string | null };

/**
 * Separates public read access from productive synchronisation: the bundle always delivers what
 * is publicly visible, but only `sync_allowed` products may be written/cache-invalidated by a
 * receiver's automatic reconcile. Fail closed for DE/COM when the gate is missing or stopped.
 */
export function syncScope(gate: OperatingGate | null, channel: string, pilotHubId: string | null): SyncScope {
  if (!GOVERNED.includes(channel)) return { governed: false };
  const site = gate?.channels?.[channel];
  const stopped = !gate || gate.emergency_stopped !== false;
  const mode = stopped ? 'blocked' : (site?.mode === 'pilot' || site?.mode === 'full' ? site.mode : 'blocked');
  return { governed: true, mode, emergency_stopped: stopped, pilot_product_id: mode === 'pilot' ? pilotHubId : null };
}

export function syncAllowed(gate: OperatingGate | null, channel: string, productUuid: string): boolean | null {
  if (!GOVERNED.includes(channel)) return null;
  return channelAllowed(gate, channel, productUuid);
}

/** Same channel rule as the existing media/documents subroutes: empty list = all channels. */
export function forChannel<T extends { channels?: string[] | null }>(rows: T[], channel: string | null): T[] {
  return rows.filter((r) => !channel || (r.channels || []).length === 0 || (r.channels || []).includes(channel));
}

export function groupBy<T extends Record<string, any>>(rows: T[], key: string): Record<string, Omit<T, typeof key>[]> {
  const out: Record<string, any[]> = {};
  for (const r of rows) {
    const { [key]: k, ...rest } = r;
    (out[k] ??= []).push(rest);
  }
  return out;
}
