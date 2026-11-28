export type Check = { name: string; passed: boolean; detail: string };
/** Manifest, not today's production rows, is the authoritative restore target. */
export function manifestPreflight(manifest: any, restored: Record<string, any[]>, hashFailures: string[]) {
  const tables = Object.keys(manifest.counts ?? {}).filter(t => t.startsWith('ph_'));
  const checks: Check[] = [{ name: 'SHA-256', passed: hashFailures.length === 0, detail: hashFailures.join('; ') || 'Alle gelesenen Teile stimmen' }];
  for (const t of tables) checks.push({ name: t, passed: restored[t]?.length === manifest.counts[t], detail: `${restored[t]?.length ?? 0} / ${manifest.counts[t]} Datensätze laut Sicherungsmanifest` });
  const ids = new Set((restored.ph_products ?? []).map(p => p.id));
  for (const t of ['ph_media', 'ph_documents', 'ph_product_channels']) {
    const orphans = (restored[t] ?? []).filter(r => r.product_id && !ids.has(r.product_id)).length;
    checks.push({ name: `${t}: Gerätezuordnung`, passed: orphans === 0, detail: `${orphans} verwaiste Zuordnungen` });
  }
  return { passed: tables.includes('ph_products') && checks.every(c => c.passed), checks };
}

/** A successful local preview is never a receiver's confirmation. */
export function evaluateApex(bundle: any, local: any, channel: 'de' | 'com', receiverConfirmed = false) {
  const all = [...(bundle.products ?? []), ...(bundle.offline_products ?? [])];
  const matches = all.filter(p => p.slug === 'alix-apex');
  const p = matches[0];
  const valid = matches.length === 1 && local?.slug === 'alix-apex' && p?.alix_product_id === local?.alix_product_id;
  const emergency = bundle.sync_scope?.emergency_stopped === true;
  const allBlocked = all.every(p => p.sync_allowed === false);
  const checks: Check[] = [
    { name: 'Eindeutige Geräteidentifikation', passed: valid, detail: valid ? String(p.alix_product_id) : 'Apex fehlt, ist mehrdeutig oder hat eine abweichende Kennung' },
    { name: 'Kanal und Vertrag', passed: bundle.channel === channel && bundle.contract === '1.3', detail: `${bundle.channel ?? 'fehlt'} · v${bundle.contract ?? 'fehlt'}` },
    { name: 'Notstopp – serverseitiger Abruf', passed: !emergency || allBlocked, detail: emergency ? (allBlocked ? 'Alle Übernahmen gesperrt' : 'Mindestens ein Gerät ist trotz Notstopp übernehmbar') : 'Kein aktiver Notstopp im Abruf' },
    { name: 'Empfänger bestätigt ausschließlich Apex', passed: receiverConfirmed, detail: receiverConfirmed ? 'Signiert bestätigt' : 'Nicht vollständig geprüft: bestehende Testrückmeldung enthält keinen Apex-Scope-Nachweis' },
  ];
  return { passed: checks.every(c => c.passed), checks, product: p ?? null, excluded: all.filter(x => x !== p).map(x => x.alix_product_id), emergency };
}