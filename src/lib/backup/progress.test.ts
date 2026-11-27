import { describe, expect, it } from 'vitest';
import { fullBackupOverdue, parseBackupProgress } from './progress';

describe('backup progress', () => {
  it('reads the current table and position', () => {
    const p = parseBackupProgress('Backup läuft · Tabelle 13/312: alix_sign_signatures ab Datensatz 5 · 40 Dateien · 43.2 MB gesichert · ausstehend: 299 Tabellen, 11 Speicher');
    expect(p).toMatchObject({ phase: 'tables', current: 13, total: 312, item: 'alix_sign_signatures ab Datensatz 5' });
  });
  it('reads the storage phase', () => {
    expect(parseBackupProgress('Backup läuft · Speicher 2/11: product-hub-docs · 9 Dateien')?.phase).toBe('storage');
  });
  it('returns null for other messages', () => {
    expect(parseBackupProgress('Backup erfolgreich.')).toBeNull();
  });
});

describe('24-hour full backup warning', () => {
  const now = new Date('2026-11-27T12:00:00Z');
  it('warns without any successful backup', () => expect(fullBackupOverdue(null, now)).toBe(true));
  it('warns after more than 24 hours', () => expect(fullBackupOverdue('2026-11-26T11:59:00Z', now)).toBe(true));
  it('does not warn within 24 hours', () => expect(fullBackupOverdue('2026-11-26T12:30:00Z', now)).toBe(false));
});
