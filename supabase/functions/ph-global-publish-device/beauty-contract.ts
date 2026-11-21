export const beautyEndpoint = 'https://alix-beauty.com/api/public/product-hub/deactivate';
export function confirmedBeautyOffline(reply: Record<string, any>, request: Record<string, unknown>, dry: boolean) {
  if (reply.ok !== true || ['operation_id', 'hub_id', 'channel', 'version'].some(field => reply[field] !== request[field])) return false;
  if (dry) return reply.offline === false && reply.state === 'validated';
  if (reply.offline !== true || reply.online !== false || reply.dry_run !== false || reply.state !== 'OFFLINE') return false;
  const proof = reply.verification;
  if (!proof || ![404, 410].includes(proof.detail_status) || proof.catalog_visible !== false || proof.search_visible !== false) return false;
  try {
    const url = new URL(proof.public_url);
    return url.origin === 'https://alix-beauty.com' && !url.username && !url.password && url.pathname.startsWith('/beauty-geraete/') && !url.search && !url.hash;
  } catch { return false; }
}