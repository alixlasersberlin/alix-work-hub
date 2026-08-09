import { navItems, type NavChild } from '@/lib/nav/navItems';

/**
 * Zugriffsbeschränkung für die Rolle „Österreich".
 *
 * Die Rolle Österreich ist ausschließlich für Vorgänge des Mandanten
 * Alix Austria (`source_system = 'zoho_eu_2'`) gedacht. Sie darf für sich
 * genommen KEINEN weiteren Zugriff eröffnen: Nutzer, die nur diese Rolle
 * besitzen, sehen und erreichen ausschließlich die Module, in denen die
 * Rolle explizit hinterlegt ist – alle Daten dort sind bereits AT-gefiltert
 * (useAtOnly / RLS).
 */

/** Basisrouten, die jeder eingeloggte Nutzer braucht. */
const BASE_ALLOWED = new Set<string>([
  '/', '/start', '/willkommen', '/dashboard',
  '/sicherheit', '/profil', '/mein-profil',
  '/einstellungen/personalisierung',
  '/mfa-setup', '/mfa-challenge',
]);

/** Pfade, die trotz Rollenzuordnung für AT gesperrt bleiben (DE-Lagerbereiche). */
const AT_BLOCKED = new Set<string>([
  '/lager/equipment-area/unterwegs',
  '/lager/equipment-area/produktion',
  '/lager/equipment-area/warehouse',
  '/lager/equipment-area/hold',
  '/auftraege-ch',
]);

function collect(items: NavChild[], out: Set<string>) {
  for (const it of items) {
    const allowed = Array.isArray(it.roles) && it.roles.includes('Österreich');
    if (allowed && !it.path.startsWith('#') && !AT_BLOCKED.has(it.path)) out.add(it.path);
    if (it.children?.length) collect(it.children, out);
  }
}

let cache: Set<string> | null = null;

/** Alle Pfade, die die Rolle Österreich laut Navigation erreichen darf. */
export function atAllowedPaths(): Set<string> {
  if (!cache) {
    const set = new Set<string>(BASE_ALLOWED);
    collect(navItems as NavChild[], set);
    cache = set;
  }
  return cache;
}

/**
 * Prüft, ob ein Pfad für einen reinen Österreich-Nutzer erlaubt ist.
 * Unterpfade (Detailseiten) eines erlaubten Pfads sind ebenfalls erlaubt.
 */
export function isAtOnlyPathAllowed(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const blocked of AT_BLOCKED) {
    if (path === blocked || path.startsWith(`${blocked}/`)) return false;
  }
  const allowed = atAllowedPaths();
  if (allowed.has(path)) return true;
  for (const p of allowed) {
    if (p !== '/' && path.startsWith(`${p}/`)) return true;
  }
  return false;
}
