export type ComCardCheck = {
  state: 'removed' | 'visible' | 'unknown'; message: string; checked_at: string;
  catalog_url: string; product_id: string; remote_product_id: string | null;
  operation_id: string | null; attempts: number; card_count: number | null;
  matched_urls: string[]; recorded?: boolean;
};

export function cardCheckLabel(check?: ComCardCheck | null) {
  if (!check) return 'Noch nicht geprüft';
  return check.state === 'removed' ? 'Karte verschwunden' : check.state === 'visible' ? 'Karte weiterhin sichtbar' : 'Nicht nachweisbar';
}

export function isComCardCheck(value: unknown): value is ComCardCheck {
  if (!value || typeof value !== 'object') return false;
  const check = value as Record<string, unknown>;
  return ['removed', 'visible', 'unknown'].includes(String(check.state)) && typeof check.checked_at === 'string' && typeof check.product_id === 'string' && typeof check.message === 'string';
}