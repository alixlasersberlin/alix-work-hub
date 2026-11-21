import type { Channel } from './contract.ts';

export function offlineReason(product: Record<string, unknown>, channel: Channel, hold: boolean): 'inactive' | 'withheld' | null {
  if (product[channel === 'com' ? 'active_com' : 'active_de'] === false) return 'inactive';
  return hold ? 'withheld' : null;
}

export function confirmedOffline(reply: Record<string, unknown>, request: Record<string, unknown>, dry: boolean): boolean {
  const host = request.channel === 'de' ? 'alix-lasers.de' : 'www.alix-lasers.com';
  return reply.ok === true && (dry ? reply.status === 'OFFLINE_READY' && reply.offline === false && reply.dry_run === true : reply.status === 'OFFLINE' && reply.offline === true) &&
    ['operation_id', 'product_id', 'hub_id', 'source_version', 'channel'].every(field => reply[field] === request[field]) &&
    Array.isArray(reply.public_urls) && reply.public_urls.length > 0 && reply.public_urls.every(value => {
      if (typeof value !== 'string') return false;
      try { const url = new URL(value); return url.protocol === 'https:' && url.host === host && !url.username && !url.password; } catch { return false; }
    });
}