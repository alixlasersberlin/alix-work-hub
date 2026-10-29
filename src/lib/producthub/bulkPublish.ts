import { PH_ACTIVE_FIELD } from './config';

export interface BulkProduct { id: string; name: string }
export interface BulkSite { code: string; name: string; is_active: boolean }
export interface BulkMapping { product_id: string; site_code: string; remote_product_id: string; verified_at: string | null }
export interface BulkResult { productId: string; product: string; site: string; state: 'accepted' | 'available' | 'error' | 'skipped'; note: string }
export interface BulkPublishPorts {
  updateProduct: (id: string, patch: Record<string, unknown>) => Promise<void>;
  updateChannel: (id: string, code: string, patch: Record<string, unknown>) => Promise<void>;
  pushCom: (id: string) => Promise<void>;
}

export async function publishAllProducts(products: BulkProduct[], sites: BulkSite[], mappings: BulkMapping[], ports: BulkPublishPorts,
  onProgress: (completed: number, result: BulkResult) => void) {
  const targets = sites.filter(s => s.is_active);
  let completed = 0;
  for (const product of products) {
    for (const site of targets) {
      const result: BulkResult = { productId: product.id, product: product.name, site: site.name, state: 'error', note: '' };
      const confirmed = site.code !== 'com' || mappings.some(m => m.product_id === product.id && m.site_code === 'com' && !!m.verified_at && !!m.remote_product_id.trim());
      if (!confirmed) {
        result.state = 'skipped'; result.note = 'Keine bestätigte Gerätezuordnung – nicht übertragen';
      } else {
        try {
          const field = PH_ACTIVE_FIELD[site.code];
          await ports.updateProduct(product.id, { status: 'published', ...(field ? { [field]: true } : {}) });
          await ports.updateChannel(product.id, site.code, {
            hold: false, status: 'published', publish_state: 'published', has_pending_changes: true,
          });
          if (site.code === 'com') {
            await ports.pushCom(product.id);
            await ports.updateChannel(product.id, site.code, { has_pending_changes: false, last_sync_at: new Date().toISOString(), last_sync_status: 'ok' });
            result.state = 'accepted'; result.note = 'Texte, Technik und Bilder von der Webseite bestätigt';
          } else {
            result.state = 'available'; result.note = 'Freigegeben – für Webseitenabruf bereit; Annahme noch nicht bestätigt';
          }
        } catch (error) {
          result.note = error instanceof Error ? error.message : String((error as { message?: string })?.message || 'Freigabe fehlgeschlagen');
        }
      }
      onProgress(++completed, result);
    }
  }
}