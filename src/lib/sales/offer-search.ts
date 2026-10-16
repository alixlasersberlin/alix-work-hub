interface SearchableOffer {
  offerNumber?: string | null;
  createdByName?: string | null;
  customer?: {
    company_name?: string | null;
    contact_name?: string | null;
    email?: string | null;
  } | null;
}

export function matchesOfferSearch(offer: SearchableOffer, search: string): boolean {
  const query = search.trim().toLocaleLowerCase('de-DE');
  return !query || [
    offer.offerNumber,
    offer.createdByName,
    offer.customer?.company_name,
    offer.customer?.contact_name,
    offer.customer?.email,
  ].some(value => value?.toLocaleLowerCase('de-DE').includes(query));
}