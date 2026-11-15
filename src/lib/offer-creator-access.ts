/** Rolle, die ausschließlich Angebote erstellen und eigene Angebote sehen darf. */
export const OFFER_CREATOR_ROLE = 'Angebotsersteller';
export const OFFER_CREATOR_PATHS = ['/verkauf/angebote', '/verkauf/angebot/neu', '/mfa', '/auth'];

export function isOfferCreatorOnly(roles: readonly string[]): boolean {
  return roles.length > 0 && roles.every((r) => r === OFFER_CREATOR_ROLE);
}
