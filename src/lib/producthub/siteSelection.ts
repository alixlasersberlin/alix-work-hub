import { PH_ACTIVE_FIELD } from './config';

export function isSiteSelected(product: Record<string, unknown>, code: string, custom: Record<string, boolean>): boolean {
  const field = PH_ACTIVE_FIELD[code];
  return field ? product[field] === true : custom[code] === true;
}

export function siteSelectionPatch(active: boolean, previousStatus?: string) {
  return {
    status: active ? (previousStatus && previousStatus !== 'inactive' ? previousStatus : 'draft') : 'inactive',
    hold: !active,
  };
}