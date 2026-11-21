import { z } from 'npm:zod@3';

export const endpoints = {
  com: 'https://www.alix-lasers.com/api/public/product-hub/direct-release',
  de: 'https://alix-lasers.de/api/public/product-hub/direct-release',
} as const;
export type Channel = keyof typeof endpoints;
const textMap: Record<string, string> = { name: 'product_name', short_description: 'short_description', long_description: 'long_description', features: 'features', highlights: 'highlights', applications: 'applications', seo_title: 'seo_title', seo_description: 'meta_description' };
const techMap: Record<string, string> = { model: 'model', wavelengths: 'wavelength', power: 'power', cooling: 'cooling', fluence: 'fluence', pulse_duration: 'pulse_duration', frequency: 'frequency', spot_sizes: 'spot_sizes', laser_class: 'laser_class', intended_use: 'intended_use' };
const placeholder = /(lorem ipsum|placeholder|platzhalter|dummy|testdaten|\btbd\b|xxxx+)/i;
const price = /(?:[€$£]\s*\d|\d[\d.,\s]*\s*(?:€|\$|£|EUR\b|USD\b|AED\b|GBP\b)|(?:rabatt|discount|descuento|скидк)[^.!\n]{0,40}\d\s*%)/i;
const valueSchema = z.union([z.string().trim().min(1).max(20000), z.array(z.string().trim().min(1).max(2000)).min(1).max(50)]);

export function mediaAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && (
      (['xmrmkgfgpoundfwhnxfs.supabase.co', 'dxbrovbbwrtdsimdnrpy.supabase.co'].includes(url.hostname) && url.pathname.startsWith('/storage/v1/object/public/')) ||
      (url.hostname === 'framerusercontent.com' && url.pathname.startsWith('/images/')));
  } catch { return false; }
}

export function buildContent(product: Record<string, unknown>, translation: Record<string, unknown> | null, channel: Channel, media: { url: string }[]) {
  const source = channel === 'de' ? product : translation;
  if (!source || (channel === 'com' && !['approved', 'published'].includes(String(source.status)))) throw new Error('Freigegebene englische Texte fehlen; kein deutscher Ersatztext für COM');
  const fields: { field: string; value: string | string[]; status: 'approved' }[] = [];
  for (const [hub, field] of Object.entries(textMap)) {
    const raw = source[hub];
    if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) continue;
    const value = valueSchema.parse(raw);
    if (placeholder.test(JSON.stringify(value)) || price.test(JSON.stringify(value))) throw new Error(`Unzulässiger Text in ${field}; keine Platzhalter oder Preisangaben übertragen`);
    fields.push({ field, value, status: 'approved' });
  }
  for (const field of ['product_name', 'short_description', 'long_description']) {
    if (!fields.some(row => row.field === field && typeof row.value === 'string')) throw new Error(`Pflichttext fehlt: ${field}`);
  }
  const technical: Record<string, string> = {};
  for (const [hub, remote] of Object.entries(techMap)) {
    const raw = hub === 'intended_use' && channel === 'com' ? source[hub] : product[hub];
    const value = Array.isArray(raw) ? raw.join(' / ') : raw == null ? '' : String(raw).trim();
    if (value) technical[remote] = z.string().max(2000).parse(value);
  }
  const main_image = String(product.hero_image_url ?? '');
  if (!mediaAllowed(main_image)) throw new Error('Öffentliches Hauptbild fehlt oder Bildquelle ist nicht freigegeben');
  const gallery = [...new Set(media.map(row => row.url).filter(url => url !== main_image))];
  if (gallery.length > 30 || !gallery.every(mediaAllowed)) throw new Error('Galerie enthält zu viele Bilder oder nicht freigegebene Bildquellen');
  return { locale: channel === 'com' ? 'en' : 'de', fields, technical, main_image, gallery };
}

export async function versionFor(content: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(content)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function signedHeaders(key: string, raw: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const signingKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(`${timestamp}.${raw}`));
  return { 'Content-Type': 'application/json', 'x-alixwork-timestamp': timestamp,
    'x-alixwork-signature': `sha256=${Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')}` };
}

export function confirmedReply(reply: Record<string, unknown>, release: Record<string, unknown>, dry: boolean): boolean {
  return reply.ok === true && (dry ? reply.status === 'WRITE_READY' && reply.online === false : reply.status === 'ONLINE' && reply.online === true) &&
    ['publish_id', 'product_id', 'hub_id', 'source_version', 'channel'].every(field => reply[field] === release[field]) &&
    typeof reply.public_url === 'string' && reply.public_url.startsWith(release.channel === 'de' ? 'https://alix-lasers.de/produkte/' : 'https://www.alix-lasers.com/devices/');
}