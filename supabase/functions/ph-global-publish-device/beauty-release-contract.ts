export const beautyReleaseEndpoint = 'https://alix-beauty.com/api/public/product-hub/release';

export function buildBeautyRelease(product: Record<string, unknown>, actorId: string, publicationId: string, approvedAt: string) {
  if (typeof product.alix_product_id !== 'string' || !product.alix_product_id.trim() || typeof product.updated_at !== 'string' || !Number.isFinite(Date.parse(product.updated_at))) throw new Error('Beauty-Gerätekennung oder Quellversion fehlt');
  return { schema_version: 1, publication_id: publicationId, hub_id: product.alix_product_id, version: product.updated_at,
    channel: 'beautyco', country: 'DE', locale: 'de', target_origin: 'https://alix-beauty.com', dry_run: true,
    approval: { source: 'alixwork', role: 'Super Admin', actor_id: actorId, approved_at: approvedAt } };
}

export function confirmedBeautyRelease(reply: Record<string, unknown>, request: Record<string, unknown>, dry: boolean) {
  if (reply.ok !== true || reply.online !== !dry || reply.dry_run !== dry || reply.state !== (dry ? 'validated' : 'online') ||
    !['hub_id', 'version', 'publication_id', 'channel'].every(field => reply[field] === request[field]) || reply.channel !== 'beautyco') return false;
  if (typeof reply.public_url !== 'string' || !/^https:\/\/alix-beauty\.com\/beauty-geraete\/[a-z0-9-]+$/.test(reply.public_url)) return false;
  return dry || (typeof reply.content_hash === 'string' && /^[a-f0-9]{64}$/.test(reply.content_hash));
}