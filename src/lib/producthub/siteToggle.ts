import { PH_ACTIVE_FIELD } from './config';
import { releaseSingleProduct } from './webRelease';
import type { BulkMapping, BulkProduct, BulkPublishPorts, BulkResult, BulkSite } from './bulkPublish';

export async function toggleProductSite(product: BulkProduct, site: BulkSite, active: boolean,
  channel: Record<string, any> | undefined, mappings: BulkMapping[], ports: BulkPublishPorts): Promise<string> {
  if (['us', 'usa'].includes(site.code)) throw new Error('US bleibt von Änderungen ausgenommen');
  if (active) {
    const snapshot = channel?.remote_snapshot;
    if (snapshot?.global_offline || snapshot?.global_offline_pending || snapshot?.global_pending || snapshot?.beauty_offline || snapshot?.beauty_offline_pending || snapshot?.beauty_pending || snapshot?.ae_pending) {
      throw new Error('Abschaltsperre oder unklarer Versand: erneute Aktivierung benötigt einen bestätigten Reaktivierungsvertrag');
    }
    const results: BulkResult[] = [];
    await releaseSingleProduct(product, [site], [site.code], mappings, ports, (_count, result) => results.push(result));
    const result = results[0];
    if (!result || result.state === 'error' || result.state === 'skipped') throw new Error(result?.note || 'Keine Freigabebestätigung');
    return result.note;
  }
  const field = PH_ACTIVE_FIELD[site.code];
  if (site.code === 'com' || site.code === 'de' || site.code === 'dubai') {
    // Mark pending before the existing product write dispatches once. Do not
    // also write hold/inactive, which would dispatch a second shutdown.
    await ports.updateChannel(product.id, site.code, { has_pending_changes: true });
    if (field) await ports.updateProduct(product.id, { [field]: false });
    return 'In AlixWork deaktiviert; das Ergebnis der Webseitenabschaltung erscheint in der Versandmeldung.';
  }
  if (field) await ports.updateProduct(product.id, { [field]: false });
  const outcome = await ports.updateChannel(product.id, site.code, { hold: true, status: 'inactive', has_pending_changes: true });
  return (outcome as { note?: string } | undefined)?.note || 'In AlixWork deaktiviert; Webseitenabschaltung noch nicht bestätigt.';
}