// Portal-Admin – privilegierte Aktionen für den AlixWork-Kundendetail-Tab "Kundenportal".
// Aktionen: activate, deactivate, change_email, resend_invite, revoke_sessions, list_audit
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = ['Super Admin', 'Admin', 'Buchhaltung', 'Geschäftsleitung'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return json({ error: 'unauthorized' }, 401);
    const actor = userData.user;

    const admin = createClient(url, serviceKey);

    // Rolle prüfen
    const { data: roles } = await admin
      .from('user_roles')
      .select('roles:role_id(name)')
      .eq('user_id', actor.id);
    const roleNames = (roles ?? []).map((r: any) => r?.roles?.name).filter(Boolean);
    if (!roleNames.some((n: string) => ALLOWED_ROLES.includes(n))) {
      return json({ error: 'forbidden', message: 'Keine Berechtigung für Portal-Verwaltung.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const customerId = String(body?.customer_id ?? '');
    if (!customerId) return json({ error: 'customer_id required' }, 400);

    // Kunde laden
    const { data: customer } = await admin
      .from('customers')
      .select('id, email, company_name, contact_name')
      .eq('id', customerId)
      .maybeSingle();
    if (!customer) return json({ error: 'customer_not_found' }, 404);

    const logAdmin = async (success: boolean, metadata: Record<string, unknown> = {}) => {
      await admin.from('customer_portal_audit_logs').insert({
        action: `admin.${action}`,
        customer_id: customerId,
        auth_user_id: actor.id,
        success,
        metadata: { actor_email: actor.email, ...metadata },
      });
    };

    switch (action) {
      case 'status': {
        const { data: link } = await admin
          .from('customer_portal_users')
          .select('id, user_id, status, invited_at, accepted_at, last_login_at, created_at')
          .eq('customer_id', customerId)
          .maybeSingle();
        let authEmail: string | null = null;
        let lastSignInAt: string | null = null;
        if (link?.user_id) {
          const { data: authUser } = await admin.auth.admin.getUserById(link.user_id);
          authEmail = authUser?.user?.email ?? null;
          lastSignInAt = (authUser?.user as any)?.last_sign_in_at ?? null;
        }
        const { count: failCount } = await admin
          .from('customer_portal_audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customerId)
          .eq('action', 'login_failed')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
        return json({ customer, link, auth_email: authEmail, last_sign_in_at: lastSignInAt, recent_failed_logins: failCount ?? 0 });
      }

      case 'activate': {
        const email = String(body?.email ?? customer.email ?? '').trim().toLowerCase();
        if (!email) return json({ error: 'email_required' }, 400);
        // Auth-User anlegen oder finden
        let authUserId: string | null = null;
        const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
        // listUsers filtert nicht direkt – nutze invite/generateLink stattdessen:
        const { data: invite, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${new URL(req.url).origin.replace('functions.', '').replace('/functions/v1/portal-admin', '')}/kunde/login`,
        });
        if (invErr && !/already/i.test(invErr.message)) {
          await logAdmin(false, { step: 'invite', error: invErr.message });
          return json({ error: 'invite_failed', message: invErr.message }, 400);
        }
        if (invite?.user) {
          authUserId = invite.user.id;
        } else {
          // User existiert bereits – suchen
          const { data: all } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const found = all?.users?.find((u) => (u.email ?? '').toLowerCase() === email);
          authUserId = found?.id ?? null;
        }
        if (!authUserId) {
          await logAdmin(false, { step: 'lookup' });
          return json({ error: 'user_lookup_failed' }, 500);
        }
        // upsert customer_portal_users
        const { data: existingLink } = await admin
          .from('customer_portal_users')
          .select('id')
          .eq('customer_id', customerId)
          .maybeSingle();
        if (existingLink) {
          await admin.from('customer_portal_users').update({
            user_id: authUserId, status: 'active', invited_at: new Date().toISOString(),
          }).eq('id', existingLink.id);
        } else {
          await admin.from('customer_portal_users').insert({
            customer_id: customerId, user_id: authUserId, status: 'active',
            invited_at: new Date().toISOString(),
          });
        }
        await logAdmin(true, { email, auth_user_id: authUserId });
        return json({ ok: true, auth_user_id: authUserId });
      }

      case 'deactivate': {
        const { data: link } = await admin
          .from('customer_portal_users')
          .select('id, user_id')
          .eq('customer_id', customerId).maybeSingle();
        if (!link) return json({ error: 'no_link' }, 404);
        await admin.from('customer_portal_users').update({ status: 'disabled' }).eq('id', link.id);
        if (link.user_id) {
          try { await admin.auth.admin.signOut(link.user_id, 'global'); } catch { /* noop */ }
        }
        await logAdmin(true);
        return json({ ok: true });
      }

      case 'revoke_sessions': {
        const { data: link } = await admin
          .from('customer_portal_users')
          .select('user_id')
          .eq('customer_id', customerId).maybeSingle();
        if (!link?.user_id) return json({ error: 'no_link' }, 404);
        await admin.auth.admin.signOut(link.user_id, 'global');
        await logAdmin(true);
        return json({ ok: true });
      }

      case 'resend_invite': {
        const { data: link } = await admin
          .from('customer_portal_users')
          .select('user_id')
          .eq('customer_id', customerId).maybeSingle();
        if (!link?.user_id) return json({ error: 'no_link' }, 404);
        const { data: authUser } = await admin.auth.admin.getUserById(link.user_id);
        const email = authUser?.user?.email;
        if (!email) return json({ error: 'no_email' }, 400);
        const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email);
        if (invErr && !/already/i.test(invErr.message)) {
          await logAdmin(false, { error: invErr.message });
          return json({ error: 'invite_failed', message: invErr.message }, 400);
        }
        await logAdmin(true, { email });
        return json({ ok: true });
      }

      case 'change_email': {
        const newEmail = String(body?.email ?? '').trim().toLowerCase();
        if (!newEmail) return json({ error: 'email_required' }, 400);
        const { data: link } = await admin
          .from('customer_portal_users')
          .select('user_id')
          .eq('customer_id', customerId).maybeSingle();
        if (!link?.user_id) return json({ error: 'no_link' }, 404);
        const { error: updErr } = await admin.auth.admin.updateUserById(link.user_id, { email: newEmail, email_confirm: true });
        if (updErr) {
          await logAdmin(false, { error: updErr.message });
          return json({ error: 'update_failed', message: updErr.message }, 400);
        }
        await logAdmin(true, { new_email: newEmail });
        return json({ ok: true });
      }

      case 'audit': {
        const { data: logs } = await admin
          .from('customer_portal_audit_logs')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(200);
        return json({ logs: logs ?? [] });
      }

      default:
        return json({ error: 'unknown_action' }, 400);
    }
  } catch (e) {
    return json({ error: 'internal', message: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
