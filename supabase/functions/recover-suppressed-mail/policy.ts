export const blocked = ['service@alix-lasers.com', 'buchhaltung@alix-lasers.com', 'mas@alix-lasers.com'];
export const address = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();
export function recoverable(m: any) {
  return m.last_event === 'suppressed' && /@alixwork\.de>$/i.test(m.from) &&
    m.created_at >= '2026-10-01' && m.created_at < '2026-11-01' &&
    !/sicherheitscode|passwort|registrierung|neue anmeldung|test|probe/i.test(m.subject) &&
    !m.to.some((v: string) => blocked.includes(address(v))) &&
    [...(m.cc ?? []), ...(m.bcc ?? [])].some((v: string) => blocked.includes(address(v)));
}
export function key(m: any) {
  const s = m.subject.replace(/^\[Kopie\]\s*/, '');
  const order = s.match(/Anzahlung\s+(\S+)/i)?.[1];
  return `${m.to.map(address).sort().join(',')}|${m.subject.startsWith('[Kopie]') ? 'copy|' : ''}${order ? `deposit:${order}` : s}`;
}