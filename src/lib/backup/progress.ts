/** Pure helpers for the backup page and dashboard warning. */
export interface BackupProgress {
  phase: 'tables' | 'storage';
  current: number;
  total: number;
  item: string;
  /** Overall percent: tables count as 90 %, storage inventory as the last 10 %. */
  percent: number;
}

export function parseBackupProgress(message: string | null | undefined): BackupProgress | null {
  if (!message) return null;
  const t = message.match(/Tabelle (\d+)\/(\d+): ([^·]+)/);
  if (t) {
    const current = Number(t[1]), total = Number(t[2]);
    return { phase: 'tables', current, total, item: t[3].trim(), percent: Math.min(90, Math.round(((current - 1) / total) * 90)) };
  }
  const s = message.match(/Speicher (\d+)\/(\d+): ([^·]+)/);
  if (s) {
    const current = Number(s[1]), total = Number(s[2]);
    return { phase: 'storage', current, total, item: s[3].trim(), percent: 90 + Math.round(((current - 1) / total) * 10) };
  }
  return null;
}

export const FULL_BACKUP_MAX_AGE_HOURS = 24;

/** True when no successful full backup completed within the last 24 hours. */
export function fullBackupOverdue(lastSuccessAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastSuccessAt) return true;
  const t = new Date(lastSuccessAt).getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > FULL_BACKUP_MAX_AGE_HOURS * 3600_000;
}
