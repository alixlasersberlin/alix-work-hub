// Persistentes Security-Ledger V7: Zählung je Kategorie, nächstes Arbeitspaket, Fortsetzungsprompt.
// Kategorien werden nie addiert; Duplikate (duplicateOf) zählen nur über ihre native Identität.
export type LedgerStatus = 'OPEN'|'IN_PROGRESS'|'FIXED'|'TESTED'|'DEPLOYED'|'VERIFIED'|'FALSE_POSITIVE'|'BLOCKED_EXTERNAL'|'BLOCKED_TECHNICAL';
export type LedgerKind = 'native'|'original'|'db_linter'|'check';
export interface LedgerItem {
  id: string; kind: LedgerKind; priority: 'P0'|'P1'|'P2'|'P3'|'P4'; severity: string; status: LedgerStatus;
  title: string; component: string; location?: string; duplicateOf?: string; nextStep?: string; blocker?: string;
  checkedVersion?: string; deployedVersion?: string; lastChecked?: string; fix?: string; evidence?: string; package?: string;
}
export interface Ledger { version: string; generatedAt: string; versions: Record<string, any>; scan: Record<string, any>; items: LedgerItem[] }

export const WORKABLE: LedgerStatus[] = ['OPEN', 'IN_PROGRESS', 'FIXED', 'TESTED'];
const PRIO = ['P0', 'P1', 'P2', 'P3', 'P4'];
export const PACKAGE_LIMIT = 25;

export function ledgerSummary(l: Ledger) {
  const kinds: LedgerKind[] = ['native', 'original', 'db_linter', 'check'];
  const byKind = Object.fromEntries(kinds.map(k => {
    const own = l.items.filter(i => i.kind === k && !i.duplicateOf);
    const count = (s: LedgerStatus[]) => own.filter(i => s.includes(i.status)).length;
    const open = own.filter(i => WORKABLE.includes(i.status));
    return [k, {
      total: own.length, duplicates: l.items.filter(i => i.kind === k && i.duplicateOf).length,
      open: open.length,
      openBySeverity: { critical: open.filter(i => i.severity === 'critical').length, high: open.filter(i => i.severity === 'high').length, medium: open.filter(i => i.severity === 'medium').length, low: open.filter(i => i.severity === 'low').length },
      deployed: count(['DEPLOYED']), verified: count(['VERIFIED']), falsePositive: count(['FALSE_POSITIVE']),
      blocked: count(['BLOCKED_EXTERNAL', 'BLOCKED_TECHNICAL']),
    }];
  }));
  const scanCurrent = l.scan.status === 'complete' && l.scan.sourceCommit === l.versions.baseCommit;
  const releaseBlocked = l.items.some(i => !i.duplicateOf && ['critical', 'high'].includes(i.severity) && !['VERIFIED', 'FALSE_POSITIVE'].includes(i.status));
  return { byKind, scanCurrent, releaseBlocked };
}

export function workPackages(l: Ledger) {
  const groups = new Map<string, LedgerItem[]>();
  for (const i of l.items) {
    if (i.duplicateOf || i.kind === 'check' || !WORKABLE.includes(i.status)) continue;
    const key = `${i.kind}|${i.component}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  const pkgs = [...groups.entries()].flatMap(([key, items]) => {
    const sorted = [...items].sort((a, b) => PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority) || a.id.localeCompare(b.id));
    const chunks: LedgerItem[][] = [];
    for (let n = 0; n < sorted.length; n += PACKAGE_LIMIT) chunks.push(sorted.slice(n, n + PACKAGE_LIMIT));
    return chunks.map((chunk, idx) => ({
      id: `${key}#${idx + 1}`, kind: chunk[0].kind, component: chunk[0].component,
      priority: chunk.map(i => i.priority).sort((a, b) => PRIO.indexOf(a) - PRIO.indexOf(b))[0],
      inProgress: chunk.some(i => i.status !== 'OPEN'), items: chunk,
    }));
  });
  // Begonnene Pakete zuerst, dann Priorität, dann Größe, dann stabile ID
  return pkgs.sort((a, b) => Number(b.inProgress) - Number(a.inProgress) || PRIO.indexOf(a.priority) - PRIO.indexOf(b.priority) || b.items.length - a.items.length || a.id.localeCompare(b.id));
}

export function lastCompletedStep(l: Ledger) {
  return l.items.filter(i => i.lastChecked && ['DEPLOYED', 'VERIFIED', 'TESTED'].includes(i.status) && i.fix)
    .sort((a, b) => (b.lastChecked ?? '').localeCompare(a.lastChecked ?? ''))[0] ?? null;
}

export function continuationPrompt(l: Ledger) {
  const next = workPackages(l)[0];
  const blocked = l.items.filter(i => i.kind === 'check' && i.status.startsWith('BLOCKED'));
  const openTests = l.items.filter(i => i.kind === 'check' && !['VERIFIED', 'FALSE_POSITIVE'].includes(i.status) && !i.status.startsWith('BLOCKED'));
  const lines = [
    'ALIXWORK SECURITY – FORTSETZUNG (Ledger V7)',
    `Ledger-Stand: ${l.generatedAt} · Basis-Commit ${l.versions.baseCommit} · Migration ${l.versions.migrationHead}`,
    `Letzter Tiefenscan: ${l.scan.status} auf ${l.scan.sourceCommit} (${l.scan.timestamp}) – kein Abschlussnachweis für neuere Versionen.`,
    '',
    'Lies docs/security-v7/README.md. Arbeite ausschließlich am folgenden Paket weiter, aktualisiere danach docs/security-v7/progress.csv und führe python3 scripts/security/build-ledger.py aus:',
    next ? `PAKET ${next.id} (${next.priority}, ${next.items.length} Befunde, Komponente ${next.component})` : 'KEIN technisch bearbeitbares Paket offen.',
    ...(next?.items.map(i => `- ${i.id} [${i.status}] ${i.title}${i.location ? ` – ${i.location}` : ''}`) ?? []),
    '',
    'Offene Prüfungen: ' + (openTests.map(i => `${i.title} (${i.status})`).join('; ') || 'keine'),
    'Externe Blockaden (nicht erneut erfragen): ' + (blocked.map(i => i.title).join('; ') || 'keine'),
    '',
    'Schutzvorgaben unverändert: keine Geschäfts-, Kunden-, Rechnungs-, Vertrags- oder Produktdaten ändern; 44 Produkte, Zeitpläne, Schlüssel/Secrets, Product-Hub-Sperren DE/COM und Notstopp unverändert; Sicherheitsprotokollierung aktiv; keine Kundennachrichten, keine produktiven Freigaben, nichts Destruktives ohne Genehmigung. Befunde erst mit Nachweis schließen; keine Sicherheitsfreigabe bei offenen kritischen/hohen Risiken.',
  ];
  return lines.join('\n');
}
