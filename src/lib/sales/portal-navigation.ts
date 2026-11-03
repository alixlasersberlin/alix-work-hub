export const SALES_PORTAL_ROOT = '/meine-leads';
const RETURN_KEY = 'alix_sales_return';

export function isSalesPortalPath(path: string): boolean {
  return path === SALES_PORTAL_ROOT || path.startsWith(`${SALES_PORTAL_ROOT}/`);
}

export function safeSalesReturn(value: string | null): string | null {
  if (!value || value.includes('\\') || /[\u0000-\u0020]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://alixwork.de');
    if (url.origin !== 'https://alixwork.de' || !value.startsWith('/') || value.startsWith('//')) return null;
    return isSalesPortalPath(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch { return null; }
}

export function rememberSalesReturn(value: string) {
  const target = safeSalesReturn(value);
  if (target) { try { sessionStorage.setItem(RETURN_KEY, target); } catch { /* storage unavailable */ } }
}
export function pendingSalesReturn(): string | null {
  try { return safeSalesReturn(sessionStorage.getItem(RETURN_KEY)); } catch { return null; }
}
export function clearSalesReturn() {
  try { sessionStorage.removeItem(RETURN_KEY); } catch { /* storage unavailable */ }
}