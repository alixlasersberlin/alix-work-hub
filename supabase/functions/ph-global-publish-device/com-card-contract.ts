import { parseHTML } from 'npm:linkedom@0.18.12';

export const COM_CATALOG = 'https://www.alix-lasers.com/devices';
export const DE_CATALOG = 'https://alix-lasers.de/produkte';
export type CardChannel = 'com' | 'de';
type HtmlNode = {
  textContent: string | null; getAttribute(name: string): string | null;
  querySelector(selector: string): HtmlNode | null; querySelectorAll(selector: string): HtmlNode[];
  closest(selector: string): HtmlNode | null; remove(): void;
};
export type CardState = 'removed' | 'visible' | 'unknown';
export type CardCheck = {
  state: CardState; message: string; checked_at: string; catalog_url: string;
  product_id: string; remote_product_id: string | null; operation_id: string | null;
  attempts: number; card_count: number | null; matched_urls: string[];
};

/** Only receiver-confirmed URLs for this exact current identity may prove absence. */
export function confirmedCardPaths(receipt: Record<string, unknown> | null, hubId: unknown, remoteId: unknown, channel: CardChannel = 'com'): string[] {
  if (!receipt || receipt.ok !== true || receipt.channel !== channel || !hubId || !remoteId ||
    receipt.hub_id !== hubId || receipt.product_id !== remoteId || receipt.dry_run === true ||
    !((receipt.status === 'OFFLINE' && receipt.offline === true) || (receipt.status === 'ONLINE' && receipt.online === true))) return [];
  const urls = Array.isArray(receipt.public_urls) ? receipt.public_urls : [receipt.public_url];
  return [...new Set(urls.flatMap(value => {
    if (typeof value !== 'string') return [];
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.host !== new URL(channel === 'de' ? DE_CATALOG : COM_CATALOG).host || url.username || url.password || url.search || url.hash || !(channel === 'de' ? /^\/produkte\/[^/]+\/?$/ : /^\/devices\/[^/]+\/?$/).test(url.pathname)) return [];
      return [url.pathname.replace(/\/$/, '')];
    } catch { return []; }
  }))];
}

export function inspectComCards(html: string, targetPaths: string[], channel: CardChannel = 'com'): { state: CardState; message: string; card_count: number | null; matched_urls: string[] } {
  const catalog = channel === 'de' ? DE_CATALOG : COM_CATALOG;
  const label = channel.toUpperCase();
  const detailPath = channel === 'de' ? /^\/produkte\/[^/]+\/?$/ : /^\/devices\/[^/]+\/?$/;
  const unknown = (message: string) => ({ state: 'unknown' as const, message, card_count: null, matched_urls: [] });
  if (!targetPaths.length) return unknown(`Bestätigter ${label}-Kartenlink fehlt; Verschwinden nicht nachweisbar.`);
  const { document } = parseHTML(html) as unknown as { document: HtmlNode };
  // Scripts/serialized data, SEO and footer references are not visible product cards.
  document.querySelectorAll('script, style, template, noscript').forEach(node => node.remove());
  const main = document.querySelector(channel === 'de' ? 'main[data-de-ssr-page]' : 'main#main-content');
  if (!main?.querySelector('h1')) return unknown('Öffentliche Geräteübersicht nicht vollständig ausgeliefert.');
  const counter = [...main.querySelectorAll('p, span, div')].find(node => (channel === 'de' ? /^\s*\d+\s+Systeme insgesamt\s*$/ : /^\s*\d+\s+devices\s*$/).test(node.textContent ?? ''));
  const expectedCount = Number(counter?.textContent?.trim().split(/\s+/)[0]);
  const scope = channel === 'de' ? counter?.closest('section') : main;
  if (!scope) return unknown('Vollständiger Gerätebereich fehlt.');
  const cards = [...scope.querySelectorAll('a[href]')].filter(node => {
    if (!node.querySelector(channel === 'de' ? 'span.font-display' : 'h2') || !node.querySelector('img') || node.closest('[hidden], [aria-hidden="true"]')) return false;
    try { return detailPath.test(new URL(node.getAttribute('href') ?? '', catalog).pathname); } catch { return false; }
  });
  const paths = [...new Set(cards.map(node => new URL(node.getAttribute('href') ?? '', catalog).pathname.replace(/\/$/, '')))];
  if (!Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount !== cards.length || paths.length !== cards.length) return unknown('Geräteliste leer oder unvollständig; kein Abschaltnachweis.');
  const matched = paths.filter(path => targetPaths.includes(path));
  return {
    state: matched.length ? 'visible' : 'removed',
    message: matched.length ? `Karte ist auf der öffentlichen ${label}-Geräteübersicht weiterhin sichtbar.` : `Karte ist aus der vollständig ausgelieferten ${label}-Geräteübersicht verschwunden.`,
    card_count: cards.length, matched_urls: matched.map(path => new URL(path, catalog).href),
  };
}

/** Read-only retry budget: never repeats the shutdown command. */
export async function readComCard(targetPaths: string[], read: () => Promise<string>, wait: (ms: number) => Promise<void>, channel: CardChannel = 'com') {
  let result = inspectComCards('', targetPaths, channel);
  let removedReads = 0;
  let attempts = 0;
  if (!targetPaths.length) return { ...result, attempts };
  for (const delay of [0, 2000, 5000]) {
    if (delay) await wait(delay);
    attempts++;
    try { result = inspectComCards(await read(), targetPaths, channel); }
    catch { result = { state: 'unknown', message: `${channel.toUpperCase()}-Geräteübersicht nicht erreichbar oder Abruf fehlgeschlagen.`, card_count: null, matched_urls: [] }; }
    removedReads = result.state === 'removed' ? removedReads + 1 : 0;
    if (removedReads === 2) return { ...result, attempts };
  }
  if (result.state === 'removed') return { ...result, state: 'unknown' as const, message: 'Kartenabwesenheit noch nicht durch zwei vollständige Seitenabrufe bestätigt.', attempts };
  return { ...result, attempts };
}