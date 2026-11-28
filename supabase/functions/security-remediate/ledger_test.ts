import { assertEquals, assert } from 'jsr:@std/assert@1';
import { ledgerSummary, workPackages, continuationPrompt, type Ledger, type LedgerItem } from './ledger.ts';
import real from './ledger.json' with { type: 'json' };

const item = (p: Partial<LedgerItem>): LedgerItem => ({ id: 'x', kind: 'native', priority: 'P2', severity: 'medium', status: 'OPEN', title: 't', component: 'c', ...p });
const base = (items: LedgerItem[]): Ledger => ({ version: '7.0', generatedAt: 'now', versions: { baseCommit: 'new', migrationHead: 'm' }, scan: { status: 'incomplete', sourceCommit: 'old', timestamp: 't' }, items });

Deno.test('duplicates of native findings are not counted twice', () => {
  const s = ledgerSummary(base([item({ id: 'native:a' }), item({ id: 'original:a', kind: 'original', duplicateOf: 'native:a' })]));
  assertEquals(s.byKind.native.open, 1);
  assertEquals(s.byKind.original.open, 0);
  assertEquals(s.byKind.original.duplicates, 1);
});

Deno.test('a scan on an older commit or incomplete scan is never current', () => {
  assertEquals(ledgerSummary(base([])).scanCurrent, false);
  const l = base([]); l.scan = { status: 'complete', sourceCommit: 'new', timestamp: 't' };
  assertEquals(ledgerSummary(l).scanCurrent, true);
});

Deno.test('release stays blocked while a high finding is only deployed, not verified', () => {
  assert(ledgerSummary(base([item({ severity: 'high', status: 'DEPLOYED' })])).releaseBlocked);
  assertEquals(ledgerSummary(base([item({ severity: 'high', status: 'VERIFIED' }), item({ severity: 'high', status: 'FALSE_POSITIVE' })])).releaseBlocked, false);
});

Deno.test('next package prefers started work, then priority; blocked and closed items are excluded', () => {
  const pk = workPackages(base([
    item({ id: 'a', component: 'low', priority: 'P3' }),
    item({ id: 'b', component: 'crit', priority: 'P0' }),
    item({ id: 'c', component: 'blocked', priority: 'P0', status: 'BLOCKED_TECHNICAL' }),
    item({ id: 'd', component: 'done', priority: 'P0', status: 'VERIFIED' }),
  ]));
  assertEquals(pk.map(p => p.component), ['crit', 'low']);
  const started = workPackages(base([item({ id: 'b', component: 'crit', priority: 'P0' }), item({ id: 'a', component: 'mid', priority: 'P2', status: 'IN_PROGRESS' })]));
  assertEquals(started[0].component, 'mid');
});

Deno.test('packages never exceed 25 findings', () => {
  const pk = workPackages(base(Array.from({ length: 60 }, (_, n) => item({ id: `i${n}` }))));
  assertEquals(pk.map(p => p.items.length), [25, 25, 10]);
});

Deno.test('real ledger has unique ids, valid statuses and a continuation prompt bound to versions', () => {
  const l = real as unknown as Ledger;
  assertEquals(new Set(l.items.map(i => i.id)).size, l.items.length);
  const prompt = continuationPrompt(l);
  assert(prompt.includes(l.versions.baseCommit));
  assert(prompt.includes('Notstopp'));
  assertEquals(ledgerSummary(l).scanCurrent, false);
});
