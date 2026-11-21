import { publishAllProducts, type BulkProduct, type BulkSite, type BulkMapping, type BulkPublishPorts, type BulkResult } from './bulkPublish';

export async function releaseSingleProduct(product: BulkProduct, sites: BulkSite[], selected: string[], mappings: BulkMapping[], ports: BulkPublishPorts,
  onResult: (completed: number, result: BulkResult) => void) {
  const targets = sites.filter(site => site.is_active && !['us', 'usa'].includes(site.code) && selected.includes(site.code));
  if (!targets.length) throw new Error('Bitte mindestens eine Webseite auswählen');
  await publishAllProducts([product], targets, mappings, ports, onResult);
}