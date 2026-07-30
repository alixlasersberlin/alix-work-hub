export type AccountingRegionValue = 'EU' | 'CH';

/** Zoho Branch-ID des Schweizer Buchungskreises. */
export const CH_BRANCH_ID = '598077000000065075';

const CH_COUNTRY_TOKENS = ['schweiz', 'switzerland', 'suisse', 'svizzera'];

/**
 * Ermittelt den Buchungskreis eines Datensatzes.
 * Reihenfolge: Branch-ID > Land/Ländercode > Währung > Default EU.
 */
export function detectAccountingRegion(input: {
  branch_id?: string | null;
  country?: string | null;
  country_code?: string | null;
  currency?: string | null;
}): AccountingRegionValue {
  if (input.branch_id && String(input.branch_id) === CH_BRANCH_ID) return 'CH';
  const code = (input.country_code ?? '').trim().toUpperCase();
  if (code === 'CH') return 'CH';
  const country = (input.country ?? '').trim().toLowerCase();
  if (country && CH_COUNTRY_TOKENS.some((t) => country.includes(t))) return 'CH';
  if ((input.currency ?? '').trim().toUpperCase() === 'CHF') return 'CH';
  return 'EU';
}

/** Währung des Buchungskreises. */
export function regionCurrency(region: AccountingRegionValue): 'EUR' | 'CHF' {
  return region === 'CH' ? 'CHF' : 'EUR';
}

/** Dateiname mit Region-Präfix, z.B. `DATEV_CH_2026-01.txt`. */
export function regionFileName(base: string, region: AccountingRegionValue, ext: string): string {
  const clean = base.replace(/\.+$/, '');
  return `${clean}_${region}.${ext.replace(/^\./, '')}`;
}
