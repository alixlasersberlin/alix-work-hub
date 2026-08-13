// Verwaltung der AlixWork → iPhone Kontaktsynchronisation (Tokens, Geräte, Freigaben)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { admin, sha256Hex, loadScopedCustomers, SUPABASE_URL } from '../_shared/carddav.ts';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const raw = Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24).toUpperCase();
  return raw.match(/.{1,4}/g)!.join('-');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const db = admin();

  try {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Nicht angemeldet' }, 401);
    const authed = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return json({ error: 'Nicht angemeldet' }, 401);

    const { data: isAdminRes } = await authed.rpc('is_admin');
    const isAdmin = isAdminRes === true;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const targetUser: string = body?.user_id && isAdmin ? String(body.user_id) : user.id;

    if (action === 'create_token') {
      const { data: settings } = await db.from('mobile_sync_settings').select('enabled, scope').eq('user_id', targetUser).maybeSingle();
      if (!settings?.enabled || settings.scope === 'none') {
        return json({ error: 'Für diesen Benutzer ist die Kontaktsynchronisation nicht freigegeben. Bitte zuerst im Adminbereich → Mobile Kontakte aktivieren.' }, 403);
      }
      const token = newToken();
      const { data: device, error } = await db.from('mobile_sync_devices').insert({
        user_id: targetUser,
        device_name: String(body?.device_name ?? 'iPhone').slice(0, 60),
        token_hash: await sha256Hex(token),
        token_prefix: token.slice(0, 4),
        status: 'active',
      }).select('id, device_name, created_at').single();
      if (error) throw error;
      await db.from('mobile_sync_log').insert({ user_id: targetUser, device_id: device.id, action: 'token_created', status: 'ok' });
      return json({ device, token });
    }

    if (action === 'rotate_token') {
      const id = String(body?.device_id ?? '');
      const { data: dev } = await db.from('mobile_sync_devices').select('id, user_id').eq('id', id).maybeSingle();
      if (!dev || (dev.user_id !== user.id && !isAdmin)) return json({ error: 'Nicht erlaubt' }, 403);
      const token = newToken();
      await db.from('mobile_sync_devices').update({ token_hash: await sha256Hex(token), token_prefix: token.slice(0, 4), status: 'active', revoked_at: null }).eq('id', id);
      await db.from('mobile_sync_log').insert({ user_id: dev.user_id, device_id: id, action: 'token_rotated', status: 'ok' });
      return json({ token });
    }

    if (action === 'set_status') {
      const id = String(body?.device_id ?? '');
      const status = ['active', 'blocked', 'revoked'].includes(String(body?.status)) ? String(body.status) : 'blocked';
      const { data: dev } = await db.from('mobile_sync_devices').select('id, user_id').eq('id', id).maybeSingle();
      if (!dev || (dev.user_id !== user.id && !isAdmin)) return json({ error: 'Nicht erlaubt' }, 403);
      await db.from('mobile_sync_devices').update({ status, revoked_at: status === 'revoked' ? new Date().toISOString() : null }).eq('id', id);
      await db.from('mobile_sync_log').insert({ user_id: dev.user_id, device_id: id, action: `device_${status}`, status: 'ok' });
      return json({ ok: true });
    }

    if (action === 'delete_device') {
      const id = String(body?.device_id ?? '');
      const { data: dev } = await db.from('mobile_sync_devices').select('id, user_id, device_name').eq('id', id).maybeSingle();
      if (!dev || (dev.user_id !== user.id && !isAdmin)) return json({ error: 'Nicht erlaubt' }, 403);
      await db.from('mobile_sync_log').update({ device_id: null }).eq('device_id', id);
      const { error } = await db.from('mobile_sync_devices').delete().eq('id', id);
      if (error) throw error;
      await db.from('mobile_sync_log').insert({ user_id: dev.user_id, action: 'device_deleted', status: 'ok', message: dev.device_name });
      return json({ ok: true });
    }

    if (action === 'set_scope') {
      if (!isAdmin) return json({ error: 'Nur Administratoren dürfen Freigaben ändern.' }, 403);
      const scope = String(body?.scope ?? 'none');
      const { error } = await db.from('mobile_sync_settings').upsert({
        user_id: targetUser,
        enabled: scope !== 'none' && body?.enabled !== false,
        scope,
        scope_value: body?.scope_value ? String(body.scope_value) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      await db.from('mobile_sync_log').insert({ user_id: targetUser, action: 'scope_changed', status: 'ok', message: scope });
      return json({ ok: true });
    }

    if (action === 'preview') {
      const { data: settings } = await db.from('mobile_sync_settings').select('enabled, scope, scope_value').eq('user_id', targetUser).maybeSingle();
      if (!settings?.enabled) return json({ count: 0, contacts: [] });
      const rows = await loadScopedCustomers(targetUser, settings.scope, settings.scope_value ?? null);
      return json({
        count: rows.length,
        contacts: rows.slice(0, 200).map((c) => ({
          id: c.id, company_name: c.company_name, contact_name: c.contact_name,
          email: c.email, phone: c.phone, customer_no: c.external_customer_id,
        })),
      });
    }

    return json({ error: 'Unbekannte Aktion' }, 400);
  } catch (e) {
    console.error('mobile-sync-admin error', e);
    return json({ error: (e as Error).message ?? 'Fehler' }, 500);
  }
});
