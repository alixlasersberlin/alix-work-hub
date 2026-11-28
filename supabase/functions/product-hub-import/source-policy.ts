const approvedEndpoint = 'https://alix-legacy-reborn.lovable.app/api/public/product-hub/export';

export function approvedSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.href === approvedEndpoint && !url.username && !url.password;
  } catch { return false; }
}

export function allowedImportMode(value: unknown): boolean {
  // Existing production import is isolated until its restore/migration gate is proven.
  return value === 'test' || value === 'preview';
}