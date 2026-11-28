export type LedgerStatus = 'OPEN'|'IN_PROGRESS'|'FIXED'|'TESTED'|'DEPLOYED'|'VERIFIED'|'FALSE_POSITIVE'|'BLOCKED_EXTERNAL'|'BLOCKED_TECHNICAL';
export type LedgerKind = 'native'|'original'|'db_linter'|'check';
export interface LedgerItem {
  id: string; kind: LedgerKind; priority: string; severity: string; status: LedgerStatus; title: string; component: string;
  location?: string; duplicateOf?: string; nextStep?: string; blocker?: string; checkedVersion?: string; deployedVersion?: string;
  lastChecked?: string; fix?: string; evidence?: string; source?: string; package?: string;
}
export interface KindSummary { total: number; duplicates: number; open: number; openBySeverity: Record<'critical'|'high'|'medium'|'low', number>; deployed: number; verified: number; falsePositive: number; blocked: number }
export interface SecurityLedgerResponse {
  version: string; generatedAt: string; versions: Record<string, any>; scan: Record<string, any>;
  summary: { byKind: Record<LedgerKind, KindSummary>; scanCurrent: boolean; releaseBlocked: boolean };
  nextPackage: { id: string; kind: LedgerKind; component: string; priority: string; items: LedgerItem[] } | null;
  packages: { id: string; kind: LedgerKind; component: string; priority: string; count: number; inProgress: boolean }[];
  packageCount: number; lastStep: LedgerItem | null; checks: LedgerItem[]; prompt: string; items: LedgerItem[]; automaticExecution: boolean;
}
export const KIND_LABELS: Record<LedgerKind, string> = {
  native: 'Native Scannerbefunde', original: 'Ursprüngliche Befunde (600er-Register)', db_linter: 'Datenbank-Linter-Hinweise', check: 'Prüfungen & externe Aufgaben',
};
export const STATUS_LABELS: Record<LedgerStatus, string> = {
  OPEN: 'Offen', IN_PROGRESS: 'In Arbeit', FIXED: 'Korrigiert', TESTED: 'Getestet', DEPLOYED: 'Bereitgestellt',
  VERIFIED: 'Verifiziert', FALSE_POSITIVE: 'Fehlalarm (verifiziert)', BLOCKED_EXTERNAL: 'Extern blockiert', BLOCKED_TECHNICAL: 'Technisch blockiert',
};
