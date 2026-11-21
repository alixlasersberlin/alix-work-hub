import { PH_ACTIVE_FIELD } from './config';
import { toggleProductSite } from './siteToggle';
import { websiteState } from './websiteState';
import type { BulkMapping, BulkProduct, BulkPublishPorts, BulkSite } from './bulkPublish';

export type DomainAction = 'activate' | 'deactivate' | 'sync';
export interface DomainResult { id: string; name: string; active: boolean; confirmed: boolean; note: string; receipt?: unknown }

export async function controlDomain(products: (BulkProduct & Record<string, any>)[], site: BulkSite,
  action: DomainAction, channels: Record<string, any>[], mappings: BulkMapping[], ports: BulkPublishPorts,
  progress: (result: DomainResult) => void) {
  if (['us', 'usa'].includes(site.code)) throw new Error('US bleibt ausgenommen');
  for (const product of products) {
    const row = channels.find(c => c.product_id === product.id && c.channel_code === site.code);
    const active = action === 'activate' || (action === 'sync' && websiteState(product, site.code, row).active);
    const result: DomainResult = { id: product.id, name: product.name, active, confirmed: false, note: '' };
    try {
      if (active) {
        result.note = await toggleProductSite(product, site, true, row, mappings, ports);
        result.confirmed = site.code === 'com' || site.code === 'de' || site.code === 'beautyco';
      } else {
        // The domain adapter performs a local-only product write; withholding
        // then dispatches exactly one shutdown, including already inactive rows.
        const field = PH_ACTIVE_FIELD[site.code];
        if (field) await ports.updateProduct(product.id, { [field]: false });
        const outcome = await ports.updateChannel(product.id, site.code, { hold: true, status: 'inactive', has_pending_changes: true }) as { offline?: boolean; note?: string; receipt?: unknown } | undefined;
        result.confirmed = outcome?.offline === true;
        result.note = outcome?.note || 'In AlixWork deaktiviert; Webseitenabschaltung ausstehend';
        result.receipt = outcome?.receipt;
      }
    } catch (error) {
      result.note = error instanceof Error ? error.message : 'Webseitenänderung nicht bestätigt';
    }
    progress(result);
  }
}