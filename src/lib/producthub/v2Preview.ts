import { decidePublication, normalizeChannel, ACTIVE_COLUMN, type ProductInput } from '../../../supabase/functions/_shared/ph-publication';
export { decidePublication, normalizeChannel, ACTIVE_COLUMN };
export type QueueLog = { id: string; product_id: string | null; channel_code: string | null; status: string; created_at: string; message?: string | null; payload: any };
export const REASONS: Record<string, string> = {
  regulatory_hold: 'Veröffentlichung gesperrt', missing_public_image: 'Öffentliches Hauptbild fehlt',
  missing_product_id: 'Produktkennung fehlt', missing_name: 'Produktname fehlt', missing_slug: 'Seitenkennung fehlt',
  product_not_published: 'Gerät noch nicht freigegeben', switch_off: 'In AlixWork ausgeschaltet', channel_excluded: 'US bleibt ausgenommen',
};
export function previewState(p: ProductInput & { id: string }, channel: string, hold: boolean, log?: QueueLog, override?: boolean, now = Date.now(), channelStatus = 'inactive') {
  const patch = override === undefined ? p : { ...p, [ACTIVE_COLUMN[channel] ?? 'preview_active']: override };
  const decision = decidePublication(patch, channel, { hold, status: override === undefined ? channelStatus : override ? 'published' : 'inactive' });
  if (hold || channel === 'usa' || channel === 'us') return { state: 'locked', label: 'Gesperrt', desired: decision.desired, message: REASONS[decision.reasons[0]] ?? 'Veröffentlichung gesperrt', url: null };
  if (override !== undefined) return { state: decision.reasons.some(r => r !== 'switch_off') ? 'error' : 'pending', label: override ? 'Test: AN' : 'Test: AUS', desired: decision.desired, message: decision.reasons.map(r => REASONS[r] ?? r).join(' · ') || 'Nur Testauswahl; nichts gesendet', url: null };
  const signal = log?.payload?.signal, receipt = log?.payload?.receipt;
  if (log?.status === 'failed' || ['website_error','website_mismatch'].includes(log?.payload?.confirmation))
    return { state: 'error', label: 'Fehler', desired: decision.desired, message: log?.payload?.last_error || 'Übertragung fehlgeschlagen', url: null };
  const observed = Date.parse(receipt?.observed_at ?? '');
  const matching = log?.status === 'website_confirmed' && receipt?.event_id === signal?.event_id && receipt?.channel === channel
    && receipt?.product_id === p.alix_product_id && receipt?.version === signal?.version && receipt?.state === decision.desired
    && receipt?.state === signal?.desired && Number.isFinite(observed) && now - observed <= 300_000 && now >= observed;
  if (matching) return { state: receipt.state === 'ONLINE' ? 'online' : 'offline', label: receipt.state === 'ONLINE' ? 'AN' : 'AUS', desired: decision.desired, message: 'Von Webseite bestätigt', url: receipt.state === 'ONLINE' ? receipt.public_url : null };
  if (log && ['queued','sending','awaiting_receipt','retry'].includes(log.status)) return { state: 'pending', label: 'Ausstehend', desired: decision.desired, message: 'Aktueller Webseitenstatus noch nicht bestätigt', url: null };
  return { state: 'unknown', label: 'Unbekannt', desired: decision.desired, message: decision.reasons.filter(r => r !== 'switch_off').map(r => REASONS[r] ?? r).join(' · ') || 'Kein aktueller Webseitennachweis', url: null };
}
export function newestLogs(logs: QueueLog[]) {
  const result: Record<string, QueueLog> = {};
  for (const log of logs) {
    const key = `${log.product_id}:${normalizeChannel(log.channel_code) ?? log.channel_code}`;
    if (!result[key] || String(log.payload?.signal?.version ?? '') > String(result[key].payload?.signal?.version ?? '')) result[key] = log;
  }
  return result;
}