// Shared helpers for customer portal edge functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function envClients() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return { url, anon, service };
}

/** Authenticate caller, load active portal-user binding + customer id. */
export async function authPortalUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { error: json({ error: 'unauthorized' }, 401) };

  const { url, anon, service } = envClients();
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return { error: json({ error: 'unauthorized' }, 401) };

  const admin = createClient(url, service);
  const { data: link } = await admin
    .from('customer_portal_users')
    .select('customer_id, status')
    .eq('user_id', u.user.id)
    .maybeSingle();
  if (!link || link.status !== 'active') return { error: json({ error: 'forbidden' }, 403) };

  return {
    admin,
    user: u.user,
    customerId: link.customer_id as string,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    ua: req.headers.get('user-agent') ?? null,
  };
}

export async function audit(admin: any, row: {
  customer_id: string; auth_user_id?: string | null;
  action: string; object_type?: string; object_id?: string | null;
  success?: boolean; user_agent?: string | null; ip_address?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await admin.from('customer_portal_audit_logs').insert({
    success: true,
    ...row,
  }).then(() => {}, () => {});
}

/** Send a plain HTML email via Resend if RESEND_API_KEY is configured. */
export async function sendMail(to: string | string[], subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return;
  const recipients = Array.isArray(to) ? to : [to];
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Alix Portal <no-reply@alixwork.de>',
      to: recipients,
      subject,
      html,
    }),
  }).catch(() => {});
}

export function otp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
