import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { customerSectionPatch, packageFilePathAllowed, mediaPackagePrefix, safeUploadCategory, statusNoticeAllowed } from './mediapaket-input.ts';
import { documentOperationAllowed, ownDocumentStorage } from './document-operation.ts';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
const id = '00000000-0000-0000-0000-000000000001';
const foreign = '00000000-0000-0000-0000-000000000002';
const host = 'security-final.example.test';
type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();
function configure() {
  Deno.env.set('SUPABASE_URL', `https://${host}`); Deno.env.set('SUPABASE_ANON_KEY', 'synthetic-public-final');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-final'); Deno.env.set('CRON_SECRET', 'synthetic-cron-final');
  Deno.env.set('MEDIAPAKET_TOKEN_SECRET', 'synthetic-portal-final');
}
async function load(name: string) {
  configure(); const saved = handlers.get(name); if (saved) return saved;
  const original = Deno.serve; let handler: Handler | undefined;
  Deno.serve = ((fn: Handler) => { handler = fn; return {}; }) as typeof Deno.serve;
  try { await import(`../${name}/index.ts`); } finally { Deno.serve = original; }
  if (!handler) throw new Error(`No handler: ${name}`); handlers.set(name, handler); return handler;
}
function identity(url: URL, role = 'Super Admin', active = true): Response | null {
  if (url.pathname === '/auth/v1/user') return Response.json({ id, email: 'staff@example.test' });
  if (url.pathname.endsWith('/user_profiles')) return Response.json({ is_active: active, account_status: active ? 'active' : 'disabled', invitation_status: 'accepted', password_reset_required: false });
  if (url.pathname.endsWith('/user_roles')) return Response.json([{ roles: { name: role } }]);
  if (url.pathname.endsWith('/user_tenant_access')) return Response.json([{ tenant_id: id }]);
  if (url.pathname.endsWith('/tenants')) return Response.json([{ id, code: 'DE', zoho_source_system: 'zoho_eu_1' }]);
  return null;
}
const req = (body: unknown, bearer = '') => new Request(`https://${host}/function`, { method: 'POST', headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}, body: JSON.stringify(body) });
async function token() {
  const enc = new TextEncoder(); const key = await crypto.subtle.importKey('raw', enc.encode('synthetic-portal-final'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64(enc.encode(id))}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(id))))}`;
}
Deno.test('Portal fields cannot move records or set assignment, approval, legal review and audit fields', () => {
  assertEquals(customerSectionPatch('services', { id: foreign, media_package_id: foreign, selected: true, status: 'completed', assigned_user_id: foreign }), { selected: true });
  assertEquals(customerSectionPatch('branding', { about_me: 'Customer text', legally_reviewed_claims: true, updated_at: '2099' }), { about_me: 'Customer text' });
  assertEquals(customerSectionPatch('files', { storage_path: 'other/customer.pdf', uploaded_by: foreign, approval_status: 'approved', description: 'My file' }), { description: 'My file' });
  assertEquals(customerSectionPatch('__proto__', { id }), null);
});
Deno.test('Portal file paths reject other packages, traversal and encoded path components', () => {
  const prefix = mediaPackagePrefix({ customer_id: id, order_id: id }, id);
  assert(packageFilePathAllowed(`${prefix}Logo/a.png`, prefix));
  for (const path of [`${prefix}../a.png`, `${prefix}Logo/%2e%2e.png`, `${prefix}Logo/a.png?token=foo`, `${prefix}Logo/sub/a.png`, `${prefix.replace(id, foreign)}Logo/a.png`]) assertEquals(packageFilePathAllowed(path, prefix), false);
  assertEquals(safeUploadCategory('../other'), null);
});
Deno.test('Status notices require the saved status and never accept free-form customer mail text', () => {
  assert(statusNoticeAllowed('completed', 'completed')); assertEquals(statusNoticeAllowed('completed', 'in_review'), false); assertEquals(statusNoticeAllowed('<script>', '<script>'), false);
});
Deno.test('Document deletion requires exact Super Admin; restoration never grants wider editing', () => {
  assertEquals(documentOperationAllowed(['Admin'], id, id, 'soft_delete'), false);
  assertEquals(documentOperationAllowed(['Order'], id, id, 'purge'), false);
  assert(documentOperationAllowed(['Super Admin'], id, foreign, 'soft_delete'));
  assert(documentOperationAllowed(['Read Only'], id, id, 'restore'));
  assertEquals(documentOperationAllowed(['Read Only'], id, foreign, 'restore'), false);
  assertEquals(ownDocumentStorage('alixdocs-private', `docs/${foreign}/v1/a.pdf`, id), false);
});
const names = ['alixdocs-delete', 'alixdocs-sign-return', 'sig-apply-facsimile'];
for (const name of names) {
  Deno.test(`Final ${name}: public, missing and forged credentials cannot access records or signatures`, async () => {
    const handler = await load(name), original = fetch; let records = 0;
    globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); if (u.pathname === '/auth/v1/user') return Response.json({ error: 'invalid' }, { status: 401 }); records++; throw new Error('Forbidden record or storage access'); };
    try { for (const bearer of ['', 'synthetic-public-final', 'forged']) { const r = await handler(req({}, bearer)); assertEquals(r.status, 401); await r.body?.cancel(); } assertEquals(records, 0); } finally { globalThis.fetch = original; }
  });
  Deno.test(`Final ${name}: inactive accounts cannot modify records`, async () => {
    const handler = await load(name), original = fetch;
    globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u, 'Super Admin', false); if (r) return r; throw new Error('Inactive business access'); };
    try { const r = await handler(req({}, 'staff')); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
  });
}
for (const action of ['issue_token', 'duplicate', 'notify_customer', 'notify_question', 'staff_message', 'notify_customer_status', 'send_whatsapp', 'add_watcher', 'handoff_production', 'create_from_template', 'snapshot', 'list_snapshots', 'rollback', 'toggle_showcase', 'get_showcase_config', 'gdpr_export', 'anonymize']) {
  Deno.test(`Final portal ${action}: customer token and public key cannot authorize staff actions`, async () => {
    const handler = await load('mediapaket-portal'), original = fetch; let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('Staff action reached records'); };
    try { for (const bearer of ['', 'synthetic-public-final']) { const r = await handler(req({ action, mp_id: id, token: await token() }, bearer)); assertEquals(r.status, 401); await r.body?.cancel(); } assertEquals(calls, 0); } finally { globalThis.fetch = original; }
  });
}
for (const action of ['notify_customer_status', 'handoff_production', 'duplicate']) {
  Deno.test(`Final portal ${action}: readable foreign-company packages cannot write or send`, async () => {
    const handler = await load('mediapaket-portal'), original = fetch;
    globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); assertEquals(u.hostname, host); const r = identity(u); if (r) return r; if (u.pathname.endsWith('/rpc/can_manage_media_packages')) return Response.json(true); assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(u.pathname, '/rest/v1/media_packages'); return Response.json({ id: foreign, customer_id: foreign, tenant_id: foreign }); };
    try { const r = await handler(req({ action, mp_id: foreign, new_status: 'completed' }, 'staff')); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
  });
}
Deno.test('Final portal duplication rejects a target order belonging to another customer', async () => {
  const handler = await load('mediapaket-portal'), original = fetch;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; if (u.pathname.endsWith('/rpc/can_manage_media_packages')) return Response.json(true); assertEquals(init?.method ?? 'GET', 'GET'); if (u.pathname.endsWith('/media_packages')) return Response.json({ id, customer_id: id, tenant_id: id }); if (u.pathname.endsWith('/customers')) return Response.json({ id, source_system: 'zoho_eu_1' }); if (u.pathname.endsWith('/orders')) return Response.json({ id: foreign, customer_id: foreign, source_system: 'zoho_eu_1' }); throw new Error('Unexpected access'); };
  try { const r = await handler(req({ action: 'duplicate', mp_id: id, target_order_id: foreign }, 'staff')); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Final portal status mismatch is rejected before mail, reviews or history writes', async () => {
  const handler = await load('mediapaket-portal'), original = fetch;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; if (u.pathname.endsWith('/rpc/can_manage_media_packages')) return Response.json(true); assertEquals(init?.method ?? 'GET', 'GET'); if (u.pathname.endsWith('/media_packages')) return Response.json({ id, customer_id: id, tenant_id: id, status: 'in_review' }); if (u.pathname.endsWith('/customers')) return Response.json({ id, source_system: 'zoho_eu_1' }); throw new Error('Premature mail or review'); };
  try { const r = await handler(req({ action: 'notify_customer_status', mp_id: id, new_status: 'completed' }, 'staff')); assertEquals(r.status, 409); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Final customer save persists allowed fields but no supplied workflow or record identities', async () => {
  const handler = await load('mediapaket-portal'), original = fetch; let written: any;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); assertEquals(u.hostname, host); if (u.pathname.endsWith('/media_package_services')) { written = JSON.parse(String(init?.body)); return Response.json([]); } if (u.pathname.endsWith('/rpc/calc_media_package_progress')) return Response.json(25); if (u.pathname.endsWith('/media_packages')) return Response.json([]); throw new Error('Unexpected action'); };
  try { const r = await handler(req({ action: 'save_section', token: await token(), section: 'services', values: { id: foreign, media_package_id: foreign, selected: true, status: 'completed', assigned_user_id: foreign } })); assertEquals(r.status, 200); await r.body?.cancel(); assertEquals(written, { selected: true, media_package_id: id }); } finally { globalThis.fetch = original; }
});
Deno.test('Final signed download rejects a foreign stored path before any storage signing', async () => {
  const handler = await load('mediapaket-portal'), original = fetch; let calls = 0;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); calls++; assertEquals(u.pathname, '/rest/v1/media_packages'); return Response.json({ id, customer_id: id, order_id: id }); };
  try { const r = await handler(req({ action: 'signed_download', token: await token(), path: `customers/${foreign}/private.pdf` })); assertEquals(r.status, 403); await r.body?.cancel(); assertEquals(calls, 1); } finally { globalThis.fetch = original; }
});
Deno.test('Final question reply cannot load another package or internal question', async () => {
  const handler = await load('mediapaket-portal'), original = fetch;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(u.pathname, '/rest/v1/media_package_comments'); assertEquals(u.searchParams.get('media_package_id'), `eq.${id}`); assertEquals(u.searchParams.get('internal_only'), 'eq.false'); assertEquals(u.searchParams.get('recipient_type'), 'eq.customer'); return Response.json(null); };
  try { const r = await handler(req({ action: 'answer_question', token: await token(), question_id: foreign, answer: 'Customer answer' })); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Final delete Admin cannot inherit Super Admin deletion rights', async () => {
  const handler = await load('alixdocs-delete'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u, 'Admin'); if (r) return r; if (u.pathname.endsWith('/rpc/is_internal_staff')) return Response.json(true); throw new Error('Unauthorized document access'); };
  try { const r = await handler(req({ document_id: foreign, action: 'soft_delete' }, 'staff')); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Final delete readable foreign-company document cannot be restored', async () => {
  const handler = await load('alixdocs-delete'), original = fetch;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; if (u.pathname.endsWith('/rpc/is_internal_staff')) return Response.json(true); assertEquals(init?.method ?? 'GET', 'GET'); assertEquals(u.pathname, '/rest/v1/alixdocs_documents'); return Response.json({ id: foreign, uploaded_by: foreign, tenant_id: foreign }); };
  try { const r = await handler(req({ document_id: foreign, action: 'restore' }, 'staff')); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Final signed return rejects an incomplete signature before file access', async () => {
  const handler = await load('alixdocs-sign-return'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; assertEquals(u.pathname, '/rest/v1/sig_requests'); return Response.json({ id, status: 'versendet', alixdocs_document_id: id }); };
  try { const r = await handler(req({ sig_request_id: id }, 'staff')); assertEquals(r.status, 409); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Final signed return rejects a readable foreign-company document before copying', async () => {
  const handler = await load('alixdocs-sign-return'), original = fetch;
  globalThis.fetch = async (input, init) => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u); if (r) return r; assertEquals(init?.method ?? 'GET', 'GET'); if (u.pathname.endsWith('/sig_requests')) return Response.json({ id, status: 'signiert', alixdocs_document_id: foreign }); if (u.pathname.endsWith('/alixdocs_documents')) return Response.json({ id: foreign, tenant_id: foreign }); throw new Error('Foreign copy'); };
  try { const r = await handler(req({ sig_request_id: id }, 'staff')); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Final facsimile cannot be used by an unrelated Read Only account', async () => {
  const handler = await load('sig-apply-facsimile'), original = fetch;
  globalThis.fetch = async input => { const u = new URL(String(input instanceof Request ? input.url : input)); const r = identity(u, 'Read Only'); if (r) return r; throw new Error('Signature disclosed'); };
  try { const r = await handler(req({ pdf_base64: 'JVBERg==', doc_type: 'invoice' }, 'staff')); assertEquals(r.status, 403); await r.body?.cancel(); } finally { globalThis.fetch = original; }
});
Deno.test('Final facsimile authorized PDF is stamped and audit actor cannot be forged', async () => {
  const handler = await load('sig-apply-facsimile'), original = fetch;
  const pdf = await PDFDocument.create(); pdf.addPage([600, 800]); const bytes = await pdf.save(); let actor: unknown;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input instanceof Request ? input.url : input)); assertEquals(u.hostname, host); const r = identity(u, 'Admin'); if (r) return r;
    if (u.pathname.endsWith('/sig_facsimile_settings')) return Response.json({ id, enabled: true, image_path: 'facsimile/test.png', width: 100, height: 30, show_name_line: false });
    if (u.pathname.startsWith('/storage/v1/object/')) return new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/png' } });
    if (u.pathname.endsWith('/sig_facsimile_log')) { actor = JSON.parse(String(init?.body)).applied_by; return Response.json([]); }
    throw new Error('Unexpected facsimile request');
  };
  try { const r = await handler(req({ pdf_base64: btoa(String.fromCharCode(...bytes)), doc_type: 'invoice', applied_by: foreign }, 'staff')); assertEquals(r.status, 200); const body = await r.json(); assertEquals(body.applied, true); assertEquals(actor, id); const restored = await PDFDocument.load(Uint8Array.from(atob(body.pdf_base64), c => c.charCodeAt(0))); assertEquals(restored.getPageCount(), 1); } finally { globalThis.fetch = original; }
});
