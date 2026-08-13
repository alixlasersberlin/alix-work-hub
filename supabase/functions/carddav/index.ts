// AlixWork CardDAV Kontakt-Service (read-only, AlixWork = Master)
// iOS: Einstellungen > Kontakte > Accounts > Account hinzufügen > Andere > CardDAV-Account
//   Server:   <projekt>.supabase.co
//   Pfad:     /functions/v1/carddav   (in "Erweiterte Einstellungen")
//   Benutzer: AlixWork E-Mail   Passwort: persönliches Geräte-Token
import { admin, sha256Hex, loadScopedCustomers, toVCard, uidFor, etagFor, type CustomerRow } from '../_shared/carddav.ts';

const DAV_HEADERS: Record<string, string> = {
  DAV: '1, 2, 3, addressbook, access-control',
  'MS-Author-Via': 'DAV',
  Allow: 'OPTIONS, GET, HEAD, PROPFIND, REPORT',
  'Content-Type': 'application/xml; charset=utf-8',
};

const xml = (body: string, status = 207, extra: Record<string, string> = {}) =>
  new Response(`<?xml version="1.0" encoding="utf-8"?>\n${body}`, { status, headers: { ...DAV_HEADERS, ...extra } });

const unauthorized = () =>
  new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="AlixWork Kontakte", charset="UTF-8"', 'Content-Type': 'text/plain' },
  });

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const idx = url.pathname.indexOf('/carddav');
  // Supabase strips "/functions/v1" internally – hrefs MUSS die extern erreichbare URL sein.
  const base = '/functions/v1/carddav';
  const rest = (idx >= 0 ? url.pathname.slice(idx + '/carddav'.length) : '').replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 200, headers: DAV_HEADERS });

  // ---- Basic auth ------------------------------------------------------
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('basic ')) return unauthorized();
  let username = '', password = '';
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(auth.slice(6).trim()), (c) => c.charCodeAt(0)));
    const i = decoded.indexOf(':');
    username = decoded.slice(0, i).trim().toLowerCase();
    password = decoded.slice(i + 1);
  } catch { return unauthorized(); }
  if (!username || !password) return unauthorized();

  const db = admin();
  const tokenHash = await sha256Hex(password);
  const { data: device } = await db
    .from('mobile_sync_devices')
    .select('id, user_id, status, device_name')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!device || device.status !== 'active') return unauthorized();

  const { data: profile } = await db
    .from('user_profiles')
    .select('id, email, full_name, is_active, account_status')
    .eq('id', device.user_id)
    .maybeSingle();

  if (!profile || (profile.email ?? '').toLowerCase() !== username) return unauthorized();
  if (profile.is_active === false) return unauthorized();
  if (profile.account_status && String(profile.account_status).toLowerCase() === 'locked') return unauthorized();

  const { data: settings } = await db
    .from('mobile_sync_settings')
    .select('enabled, scope, scope_value')
    .eq('user_id', device.user_id)
    .maybeSingle();

  if (!settings?.enabled || !settings.scope || settings.scope === 'none') {
    return new Response('Kontaktsynchronisation ist für diesen Benutzer nicht freigegeben.', { status: 403 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? null;
  const log = (action: string, count?: number, status = 'ok', message?: string) =>
    db.from('mobile_sync_log').insert({
      user_id: device.user_id, device_id: device.id, action, status, contact_count: count ?? null, message: message ?? null, ip,
    });

  // Read-only: AlixWork bleibt führendes System.
  if (['PUT', 'DELETE', 'POST', 'PATCH', 'MKCOL', 'MOVE', 'PROPPATCH'].includes(method)) {
    await log(method.toLowerCase(), undefined, 'blocked', 'Schreibzugriff vom Gerät ist nicht erlaubt');
    return new Response('Read-only: AlixWork ist das führende System.', { status: 403 });
  }

  const AB = `${base}/ab/alixwork/`;
  const PRINCIPAL = `${base}/p/`;

  const loadContacts = async () => {
    const rows = await loadScopedCustomers(device.user_id, settings.scope, settings.scope_value ?? null);
    return rows;
  };

  const touch = async (count: number) => {
    await db.from('mobile_sync_devices')
      .update({ last_sync_at: new Date().toISOString(), contact_count: count, last_ip: ip, user_agent: req.headers.get('user-agent') })
      .eq('id', device.id);
  };

  const contactHref = (c: CustomerRow) => `${AB}${uidFor(c)}.vcf`;

  // ---- GET single vCard -------------------------------------------------
  if ((method === 'GET' || method === 'HEAD') && rest.endsWith('.vcf')) {
    const uid = rest.split('/').pop()!.replace(/\.vcf$/, '');
    const id = uid.replace(/^alixwork_customer_/, '');
    const rows = await loadContacts();
    const c = rows.find((r) => r.id === id);
    if (!c) return new Response('Not found', { status: 404 });
    return new Response(toVCard(c, { owner: profile.full_name }), {
      status: 200,
      headers: { 'Content-Type': 'text/vcard; charset=utf-8', ETag: etagFor(c) },
    });
  }

  if (method === 'GET' || method === 'HEAD') {
    return new Response('AlixWork CardDAV', { status: 200, headers: { 'Content-Type': 'text/plain', ...DAV_HEADERS, 'Content-Type': 'text/plain' } });
  }

  const body = await req.text().catch(() => '');

  // ---- PROPFIND ---------------------------------------------------------
  if (method === 'PROPFIND') {
    const depth = req.headers.get('depth') ?? '0';

    const propfindRoot = (href: string) => xml(
      `<d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:response>
    <d:href>${xmlEsc(href)}</d:href>
    <d:propstat><d:prop>
      <d:current-user-principal><d:href>${PRINCIPAL}</d:href></d:current-user-principal>
      <d:principal-URL><d:href>${PRINCIPAL}</d:href></d:principal-URL>
      <card:addressbook-home-set><d:href>${base}/ab/</d:href></card:addressbook-home-set>
      <d:resourcetype><d:collection/></d:resourcetype>
      <d:displayname>ALIXWORK</d:displayname>
    </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
</d:multistatus>`);

    if (rest === '/' || rest === '' || rest === '/p') return propfindRoot(url.pathname);

    const abProps = `<d:resourcetype><d:collection/><card:addressbook/></d:resourcetype>
      <d:displayname>ALIXWORK</d:displayname>
      <card:addressbook-description>AlixWork Kundenkontakte</card:addressbook-description>
      <card:supported-address-data><card:address-data-type content-type="text/vcard" version="3.0"/></card:supported-address-data>
      <d:current-user-principal><d:href>${PRINCIPAL}</d:href></d:current-user-principal>
      <d:current-user-privilege-set><d:privilege><d:read/></d:privilege></d:current-user-privilege-set>
      <d:supported-report-set>
        <d:supported-report><d:report><card:addressbook-multiget/></d:report></d:supported-report>
        <d:supported-report><d:report><card:addressbook-query/></d:report></d:supported-report>
        <d:supported-report><d:report><d:sync-collection/></d:report></d:supported-report>
      </d:supported-report-set>`;

    // Addressbook home: list the single ALIXWORK addressbook
    if (rest === '/ab') {
      return xml(`<d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:response><d:href>${base}/ab/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype><d:displayname>AlixWork</d:displayname></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
  <d:response><d:href>${AB}</d:href>
    <d:propstat><d:prop>${abProps}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>
</d:multistatus>`);
    }

    if (rest === '/ab/alixwork') {
      if (depth === '0') {
        return xml(`<d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:response><d:href>${AB}</d:href><d:propstat><d:prop>${abProps}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`);
      }
      const rows = await loadContacts();
      await touch(rows.length);
      await log('propfind', rows.length);
      const items = rows.map((c) => `  <d:response><d:href>${xmlEsc(contactHref(c))}</d:href>
    <d:propstat><d:prop><d:getetag>${etagFor(c)}</d:getetag><d:getcontenttype>text/vcard; charset=utf-8</d:getcontenttype><d:resourcetype/></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>`).join('\n');
      return xml(`<d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:response><d:href>${AB}</d:href><d:propstat><d:prop>${abProps}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
${items}
</d:multistatus>`);
    }

    // single contact PROPFIND
    if (rest.endsWith('.vcf')) {
      const id = rest.split('/').pop()!.replace(/\.vcf$/, '').replace(/^alixwork_customer_/, '');
      const rows = await loadContacts();
      const c = rows.find((r) => r.id === id);
      if (!c) return new Response('Not found', { status: 404 });
      return xml(`<d:multistatus xmlns:d="DAV:"><d:response><d:href>${xmlEsc(contactHref(c))}</d:href>
  <d:propstat><d:prop><d:getetag>${etagFor(c)}</d:getetag><d:getcontenttype>text/vcard; charset=utf-8</d:getcontenttype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`);
    }

    return propfindRoot(url.pathname);
  }

  // ---- REPORT -----------------------------------------------------------
  if (method === 'REPORT') {
    const rows = await loadContacts();
    await touch(rows.length);
    const wantsData = /address-data/i.test(body);
    const isMultiget = /addressbook-multiget/i.test(body);
    const isSync = /sync-collection/i.test(body);

    let selected = rows;
    if (isMultiget) {
      const hrefs = [...body.matchAll(/<[^>]*href[^>]*>([^<]+)<\/[^>]*href>/gi)].map((m) => m[1]);
      const ids = new Set(hrefs.map((h) => decodeURIComponent(h.split('/').pop() ?? '').replace(/\.vcf$/, '').replace(/^alixwork_customer_/, '')));
      selected = rows.filter((r) => ids.has(r.id));
    }

    const responses = selected.map((c) => `  <d:response><d:href>${xmlEsc(contactHref(c))}</d:href>
    <d:propstat><d:prop><d:getetag>${etagFor(c)}</d:getetag>${wantsData || isSync ? `<card:address-data>${xmlEsc(toVCard(c, { owner: profile.full_name }))}</card:address-data>` : ''}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
  </d:response>`).join('\n');

    await log(isSync ? 'sync-collection' : isMultiget ? 'multiget' : 'query', selected.length);

    const syncToken = isSync ? `\n  <d:sync-token>${Date.now()}</d:sync-token>` : '';
    return xml(`<d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
${responses}${syncToken}
</d:multistatus>`);
  }

  return new Response('Method not allowed', { status: 405, headers: DAV_HEADERS });
});
