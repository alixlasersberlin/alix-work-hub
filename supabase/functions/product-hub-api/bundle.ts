import { channelAllowed, type OperatingGate } from '../_shared/ph-operating-mode.ts';

/** Bulk contract version; existing routes keep their unchanged responses. */
export const BUNDLE_CONTRACT = '1.2';
/** Reported only when the caller opts in with include_offline=1; default responses stay 1.2. */
export const BUNDLE_CONTRACT_OFFLINE = '1.3';
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

/** v1.3 opt-in: classification of products that are NOT in `products` (never public content). */
export type OfflineState = 'offline' | 'not_released';
export function offlineState(p: { status?: string | null }): OfflineState {
  return p.status === 'published' ? 'offline' : 'not_released';
}

/** Minimal, content-free status entry; versions fall back to updated_at when no signal exists yet. */
export function offlineEntry(
  p: { id: string; alix_product_id: string; slug: string | null; status: string | null; updated_at: string | null },
  channel: string, gate: OperatingGate | null, version: string | null,
) {
  return {
    alix_product_id: p.alix_product_id, slug: p.slug, channel,
    state: offlineState(p), online: false as const,
    sync_allowed: syncAllowed(gate, channel, p.id),
    product_version: version ?? p.updated_at, updated_at: p.updated_at,
  };
}
