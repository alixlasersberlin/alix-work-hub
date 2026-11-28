// PRODUCT HUB Release Control: read-only proofs (backup integrity, isolated in-memory restore test, bundle API check).
// Never writes product data, never changes keys, never lifts the emergency stop or enables pilot/production.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { PH_RESTORE_TABLES, summarizeBundle, bundlePassed, evaluateRestore } from './checks.ts';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('backup_proof') }),
  z.object({ action: z.literal('restore_test') }),
  z.object({ action: z.literal('bundle_check'), channel: z.enum(['de', 'com']) }),
]);
const PILOT_SLUG = 'alix-apex';
const MAX_BACKUP_AGE_H = 36;
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const hex = async (b: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b))).map(x => x.toString(16).padStart(2, '0')).join('');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !srk) return json(503, { error: 'configuration_missing' });
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json(401, { error: 'Nicht angemeldet' });
  const [{ data: profile }, { data: sa }] = await Promise.all([
    caller.from('user_profiles').select('account_status,invitation_status,password_reset_required').eq('id', user.id).maybeSingle(),
    caller.rpc('has_role', { check_role: 'Super Admin' }),
  ]);
  if (profile?.account_status !== 'active' || profile.invitation_status !== 'accepted' || profile.password_reset_required !== false || sa !== true) return json(403, { error: 'Nur aktive Super Admins' });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: body.error.flatten().fieldErrors });
  const sb = createClient(url, srk);
  const record = async (kind: string, channel: string | null, passed: boolean, details: unknown) => {
    const { error } = await sb.rpc('ph2_record_release_proof', { _kind: kind, _channel: channel, _passed: passed, _details: details, _actor: user.id });
    if (error) throw new Error(error.message);
  };
  try {
    if (body.data.action === 'bundle_check') return json(200, await bundleCheck(url, anon, body.data.channel, record));
    return json(200, await backupOrRestore(sb, body.data.action, user.id, record));
  } catch (e) { return json(500, { error: e instanceof Error ? e.message : String(e) }); }
});

async function bundleCheck(url: string, anon: string, channel: 'de' | 'com', record: (...a: any[]) => Promise<void>) {
  const key = Deno.env.get('PRODUCT_HUB_API_KEY');
  if (!key) return { passed: false, error: 'API-Schlüssel nicht hinterlegt' };
  const get = async (q: string) => {
    const t = performance.now();
    const r = await fetch(`${url}/functions/v1/product-hub-api/bundle?channel=${channel}${q}`, { headers: { 'x-api-key': key, apikey: anon }, signal: AbortSignal.timeout(20000) });
    return { status: r.status, ms: Math.round(performance.now() - t), data: r.ok ? await r.json() : (await r.body?.cancel(), null) };
  };
  const [a, b] = await Promise.all([get('&include_offline=1'), get('')]);
  const details: Record<string, unknown> = { channel, http_v13: a.status, http_v12: b.status, ms: a.ms, checked_at: new Date().toISOString() };
  if (!a.data || !b.data) { await record('bundle', channel, false, { ...details, error: 'API-Abruf fehlgeschlagen' }); return { passed: false, ...details }; }
  const s = summarizeBundle(a.data, b.data, PILOT_SLUG);
  const passed = bundlePassed(s);
  Object.assign(details, s, { sync_scope: a.data.sync_scope ?? null });
  await record('bundle', channel, passed, details);
  return { passed, ...details };
}

async function backupOrRestore(sb: any, action: 'backup_proof' | 'restore_test', uid: string, record: (...a: any[]) => Promise<void>) {
  const { data: bk, error } = await sb.from('backups_metadata').select('id,backup_status,integrity_status,backup_scope,storage_path,storage_location,completed_at,created_at,backup_size_bytes,file_count')
    .eq('backup_status', 'success').eq('backup_scope', 'full').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const base = { backup_id: bk?.id ?? null, backup_created_at: bk?.created_at ?? null, scope: bk?.backup_scope ?? null, size_bytes: bk?.backup_size_bytes ?? null, file_count: bk?.file_count ?? null, administrator: uid, checked_at: new Date().toISOString() };
  const fail = async (reason: string, extra: object = {}) => { const d = { ...base, ...extra, result: reason }; await record(action === 'backup_proof' ? 'backup' : 'restore', null, false, d); return { passed: false, ...d }; };
  if (!bk) return fail('Keine erfolgreiche Vollsicherung vorhanden');
  if (action === 'backup_proof') {
    if (bk.integrity_status !== 'valid') return fail(`Integritätsstatus ${bk.integrity_status ?? 'fehlt'}`);
    if (Date.now() - Date.parse(bk.completed_at ?? bk.created_at) > MAX_BACKUP_AGE_H * 3600e3) return fail(`Sicherung älter als ${MAX_BACKUP_AGE_H} Stunden`);
  }
  const bucket = String(bk.storage_location ?? '').split(':')[1] || 'backups';
  const { data: mBlob, error: mErr } = await sb.storage.from(bucket).download(bk.storage_path);
  if (mErr || !mBlob) return fail(`Manifest nicht lesbar: ${mErr?.message ?? ''}`);
  const manifest = JSON.parse(await mBlob.text());
  const files: { table: string; path: string; sha256?: string; rows?: number }[] = manifest.files ?? [];
  const phFiles = files.filter(f => f.table.startsWith('ph_'));
  const phTables = new Set(phFiles.map(f => f.table));
  const missing = PH_RESTORE_TABLES.filter(t => !phTables.has(t) && !(manifest.counts?.[t] === 0));
  const targets = action === 'backup_proof' ? phFiles : phFiles.filter(f => (PH_RESTORE_TABLES as readonly string[]).includes(f.table));
  const hashFailures: string[] = [];
  const restored: Record<string, any[]> = {};
  for (const t of PH_RESTORE_TABLES) if (manifest.counts?.[t] === 0) restored[t] = [];
  for (const f of targets) {
    const { data: blob, error: e } = await sb.storage.from(bucket).download(f.path);
    if (e || !blob) { hashFailures.push(`${f.path} (nicht lesbar)`); continue; }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!f.sha256 || await hex(bytes) !== f.sha256) { hashFailures.push(f.path); continue; }
    if (action === 'restore_test') {
      const rows = new TextDecoder().decode(bytes).split('\n').filter(Boolean).map(l => JSON.parse(l));
      (restored[f.table] ??= []).push(...rows);
    }
  }
  if (action === 'backup_proof') {
    const passed = hashFailures.length === 0 && missing.length === 0;
    const d = { ...base, integrity: bk.integrity_status, ph_tables: phTables.size, ph_parts: phFiles.length, missing_tables: missing, hash_failures: hashFailures, result: passed ? 'bestanden' : 'nicht bestanden' };
    await record('backup', null, passed, d);
    return { passed, ...d };
  }
  // Isolated environment: the restored copy lives only in this function's memory; production rows are only read.
  const live: Record<string, any[]> = {};
  for (const t of PH_RESTORE_TABLES) {
    live[t] = [];
    for (let off = 0; ; off += 1000) {
      const { data, error: e } = await sb.from(t).select('*').range(off, off + 999);
      if (e) throw new Error(`${t}: ${e.message}`);
      live[t].push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  const r = evaluateRestore({ backupCreatedAt: manifest.meta?.created_at ?? bk.created_at, restored, live, hashFailures });
  const d = { ...base, environment: 'isolierte Kopie im Arbeitsspeicher; keine Schreibzugriffe auf Produktivdaten', checks: r.checks, result: r.passed ? 'bestanden' : 'nicht bestanden' };
  await record('restore', null, r.passed, d);
  return { passed: r.passed, ...d };
}
