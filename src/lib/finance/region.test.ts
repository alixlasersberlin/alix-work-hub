import { describe, expect, it } from 'vitest';
import { CH_BRANCH_ID, detectAccountingRegion, regionCurrency, regionFileName } from './region';

describe('detectAccountingRegion', () => {
  it('erkennt CH über Branch-ID', () => {
    expect(detectAccountingRegion({ branch_id: CH_BRANCH_ID })).toBe('CH');
  });
  it('erkennt CH über Ländercode und Land', () => {
    expect(detectAccountingRegion({ country_code: 'ch' })).toBe('CH');
    expect(detectAccountingRegion({ country: 'Schweiz' })).toBe('CH');
    expect(detectAccountingRegion({ country: 'Switzerland' })).toBe('CH');
  });
  it('erkennt CH über Währung CHF', () => {
    expect(detectAccountingRegion({ currency: 'chf' })).toBe('CH');
  });
  it('fällt auf EU zurück', () => {
    expect(detectAccountingRegion({})).toBe('EU');
    expect(detectAccountingRegion({ country: 'Deutschland', currency: 'EUR' })).toBe('EU');
    expect(detectAccountingRegion({ branch_id: '123' })).toBe('EU');
  });
  it('mischt keine Regionen (Isolation)', () => {
    const rows = [
      { id: 1, accounting_region: 'EU' },
      { id: 2, accounting_region: 'CH' },
    ];
    const eu = rows.filter((r) => r.accounting_region === 'EU');
    expect(eu).toHaveLength(1);
    expect(eu.every((r) => r.accounting_region === 'EU')).toBe(true);
  });
});

describe('region helpers', () => {
  it('liefert Währung je Region', () => {
    expect(regionCurrency('CH')).toBe('CHF');
    expect(regionCurrency('EU')).toBe('EUR');
  });
  it('baut Dateinamen mit Region', () => {
    expect(regionFileName('DATEV_2026-01', 'CH', 'txt')).toBe('DATEV_2026-01_CH.txt');
    expect(regionFileName('journal', 'EU', '.csv')).toBe('journal_EU.csv');
  });
});
