/** Rolle, die ausschließlich Angebote erstellen und eigene Angebote sehen darf. */
export const OFFER_CREATOR_ROLE = 'Angebotsersteller';
export const OFFER_CREATOR_PATHS = ['/verkauf/angebote', '/verkauf/angebot/neu', '/mfa-setup', '/mfa-challenge', '/mfa-recovery', '/passwort-setzen'];

export function isOfferCreatorOnly(roles: readonly string[]): boolean {
  return roles.length > 0 && roles.every((r) => r === OFFER_CREATOR_ROLE);
}

export function offerCreatorRedirect(roles: readonly string[], pathname: string): string | null {
  if (!isOfferCreatorOnly(roles)) return null;
  if (pathname === '/' || pathname === '/login' || OFFER_CREATOR_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))) return null;
  return '/verkauf/angebote';
}

export function shouldForceWelcome(roles: readonly string[], pending: boolean): boolean {
  return pending && !isOfferCreatorOnly(roles);
}
