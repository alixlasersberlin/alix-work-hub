export const SHOP = '0213c2-4.myshopify.com';
export const API_VERSION = '2026-10';

export class ShopifyError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

// Credentials and tokens stay only in the server isolate, never in tables or logs.
export function createShopifyClient(clientId: string, clientSecret: string, request = fetch, clock = Date.now) {
  let token: string | undefined;
  let expiresAt = 0;
  let scopes: string[] = [];
  let pending: Promise<void> | undefined;
  async function refresh() {
    const response = await request(`https://${SHOP}/admin/oauth/access_token`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    // Token endpoint bodies may contain secrets: never return or log them.
    if (!response.ok) throw new ShopifyError('TOKEN_REJECTED', 'Shopify lehnt den App-Zugang ab. Client ID, Secret und gemeinsame Organisation von App und Shop prüfen.', response.status);
    const body = await response.json();
    if (typeof body.access_token !== 'string' || !body.access_token || !Number.isFinite(body.expires_in) || body.expires_in <= 60) {
      throw new ShopifyError('TOKEN_INVALID', 'Shopify hat keinen gültigen befristeten Zugang geliefert.');
    }
    token = body.access_token;
    expiresAt = clock() + (body.expires_in - 60) * 1000;
    scopes = typeof body.scope === 'string' ? body.scope.split(',').map((s: string) => s.trim()) : [];
  }
  async function graphql(query: string, variables: Record<string, unknown> = {}) {
    if (!token || clock() >= expiresAt) {
      pending ??= refresh().finally(() => { pending = undefined; });
      await pending;
    }
    if (!token) throw new ShopifyError('TOKEN_MISSING', 'Shopify-Zugang nicht verfügbar.');
    const response = await request(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      if (response.status === 401) { token = undefined; expiresAt = 0; }
      throw new ShopifyError('API_REJECTED', `Shopify hat den Leseabruf abgelehnt (HTTP ${response.status}).`, response.status);
    }
    const body = await response.json();
    if (body.errors?.length) throw new ShopifyError('GRAPHQL_REJECTED', 'Shopify verweigert die angeforderten Daten. Bestellleserechte und Kundendatenfreigabe der App prüfen.');
    if (!body.data) throw new ShopifyError('API_INVALID', 'Shopify hat keine Daten geliefert.');
    return body.data;
  }
  return { graphql, scopes: () => [...scopes] };
}