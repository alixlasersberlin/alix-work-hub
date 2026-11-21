export const aeEndpoint = 'https://alix-lasers.ae/api/public/product-hub/direct-release';
export type AEAction = 'publish' | 'deactivate' | 'reactivate';

export function aeStateAllowed(product: Record<string, unknown>, row: Record<string, any>, action: AEAction) {
  if (row.remote_snapshot?.ae_pending) throw new Error('AE-Vorgang läuft oder ist unklar; kein automatischer Neuversand');
  const prior = row.remote_snapshot?.ae_direct;
  if (action === 'deactivate') {
    if (product.active_dubai !== false && row.hold !== true) throw new Error('Artikel für AE nicht deaktiviert oder zurückgehalten');
  } else {
    if (product.active_dubai !== true || row.hold !== false || !['approved', 'published'].includes(String(product.status))) throw new Error('Artikel für AE nicht freigegeben');
    if (action === 'publish' && prior?.status === 'OFFLINE') throw new Error('AE-Abschaltsperre; explizite Reaktivierung erforderlich');
    if (action === 'reactivate' && (prior?.ok !== true || prior.offline !== true || prior.status !== 'OFFLINE' || prior.channel !== 'dubai' || prior.hub_id !== product.alix_product_id)) throw new Error('Bestätigte AE-Abschaltung für Reaktivierung fehlt');
  }
}

export function aeRequest(action: AEAction, operationId: string, hubId: string, remoteId: string, expected: string | null, actorId: string, content?: unknown, withheld = false) {
  const source_version = `ae:${operationId}`;
  return { action, ...(action === 'publish' ? { publish_id: operationId, content } : { operation_id: operationId }), hub_id: hubId, product_id: remoteId,
    channel: 'dubai', source_version, expected_version: expected, dry_run: true,
    ...(action === 'deactivate' ? { reason: withheld ? 'withheld' : 'inactive' } : {}),
    approval: { actor_id: actorId, role: 'super_admin', active: true, channel: 'dubai', hub_id: hubId, source_version, ...(action === 'reactivate' ? { reactivate: true } : {}) } };
}

export function confirmedAE(reply: Record<string, any>, request: Record<string, any>, dry: boolean) {
  const key = request.action === 'publish' ? 'publish_id' : 'operation_id';
  if (reply.ok !== true || ![key, 'hub_id', 'product_id', 'channel', 'source_version'].every(field => reply[field] === request[field]) || reply.channel !== 'dubai') return false;
  if (dry) return reply.dry_run === true && reply.online === false && reply.offline === false && reply.status === (request.action === 'publish' ? 'WRITE_READY' : request.action === 'deactivate' ? 'OFFLINE_READY' : 'REACTIVATE_READY');
  if (reply.dry_run === true || (request.action === 'deactivate' ? reply.status !== 'OFFLINE' || reply.offline !== true : reply.status !== 'ONLINE' || reply.online !== true)) return false;
  const urls = reply.public_urls;
  if (!Array.isArray(urls) || urls.length !== 2 || typeof urls[0] !== 'string' || !/^https:\/\/alix-lasers\.ae\/systems\/[a-z0-9-]+$/.test(urls[0]) || urls[1] !== urls[0].replace('/systems/', '/ar/systems/')) return false;
  return request.action === 'deactivate' || reply.public_url === urls[0];
}