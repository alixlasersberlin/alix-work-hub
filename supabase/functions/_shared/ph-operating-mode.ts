import { liveAllowed } from './ph-delivery.ts';
export type OperatingMode = 'blocked' | 'pilot' | 'full';
export type OperatingGate = Record<string, unknown> & {
  controlled_modes?: boolean; emergency_stopped?: boolean; revision?: number;
  channels?: Record<string, { mode?: OperatingMode; pilot_product_id?: string | null }>;
};
/** Fail closed; channel ID and local product UUID must match the explicit manual scope. */
export function channelAllowed(gate: OperatingGate | null, channel: string, productId: string): boolean {
  if (!gate || gate.emergency_stopped !== false || !['de', 'com'].includes(channel)) return false;
  const site = gate.channels?.[channel];
  return site?.mode === 'full' || (site?.mode === 'pilot' && !!productId && site.pilot_product_id === productId);
}
export function operatingAllowed(flag: string | undefined, gate: OperatingGate | null, channel: string, productId: string): boolean {
  return liveAllowed(flag, gate) && channelAllowed(gate, channel, productId);
}

export function revisionMatches(gate: OperatingGate | null, revision: unknown): boolean {
  return !!gate && Number.isInteger(revision) && revision === gate.revision;
}
