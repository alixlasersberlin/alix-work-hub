// Mediapaket Portal Edge Function
// Handles token-based customer access to their media package:
// - GET data
// - UPSERT any section
// - CREATE signed upload URL
// - REGISTER uploaded file metadata
// - SUBMIT (final)
//
// Token format: base64url(mp_id).base64url(HMAC_SHA256(mp_id, MEDIAPAKET_TOKEN_SECRET))
// Also accepts staff calls via Authorization: Bearer <supabase user jwt> — validated separately.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN_SECRET = Deno.env.get('MEDIAPAKET_TOKEN_SECRET')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlDecode = (s: string) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
};

async function hmac(mpId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(mpId));
  return b64url(sig);
}

async function signToken(mpId: string): Promise<string> {
  return `${b64url(enc.encode(mpId))}.${await hmac(mpId)}`;
}

async function verifyToken(token: string): Promise<string | null> {
  try {
    const [encId, sig] = token.split('.');
    if (!encId || !sig) return null;
    const mpId = b64urlDecode(encId);
    if (!/^[0-9a-f-]{36}$/i.test(mpId)) return null;
    const expected = await hmac(mpId);
    if (expected !== sig) return null;
    return mpId;
  } catch { return null; }
}

async function notifyStaff(opts: {
  mpId: string;
  subject: string;
  headline: string;
  innerHtml: string;
  action: string;
  entity_id?: string | null;
  base_url?: string;
  extraRecipientUserIds?: (string | null | undefined)[];
}) {
  try {
    const { data: mp } = await admin.from('media_packages')
      .select('id, customer_id, order_id, studio_name, assigned_to').eq('id', opts.mpId).maybeSingle();
    const { data: cust } = mp?.customer_id
      ? await admin.from('customers').select('name, email').eq('id', mp.customer_id).maybeSingle()
      : { data: null };
    const recipients = new Set<string>();
    const staffInbox = Deno.env.get('MEDIAPAKET_STAFF_INBOX') || 'vertrieb@alixwork.de';
    const uids = [(mp as any)?.assigned_to, ...(opts.extraRecipientUserIds || [])];
    for (const uid of uids) {
      if (!uid) continue;
      const { data: prof } = await admin.from('user_profiles').select('email').eq('id', uid).maybeSingle();
      if (prof?.email) recipients.add(prof.email);
    }
    if (recipients.size === 0) recipients.add(staffInbox);
    const studioLabel = (mp as any)?.studio_name || cust?.name || 'Kunde';
    const base = (opts.base_url || 'https://alixwork.de').replace(/\/$/, '');
    const orderLink = mp?.order_id ? `${base}/auftraege/${mp.order_id}?tab=mediapaket` : `${base}/`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; color:#222">
        <h2 style="color:#111">${opts.headline}</h2>
        <p><strong>${studioLabel}</strong>${cust?.email ? ` &lt;${cust.email}&gt;` : ''}</p>
        ${opts.innerHtml}
        <p style="margin: 24px 0">
          <a href="${orderLink}" style="background:#000;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
            Media Paket öffnen
          </a>
        </p>
        <p style="font-size:12px;color:#666"><a href="${orderLink}">${orderLink}</a></p>
      </div>`;
    const to = Array.from(recipients);
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-mail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify({ to, subject: opts.subject, html, from: 'vertrieb@alixwork.de' }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error('notifyStaff: send-mail failed', resp.status, t);
      return { ok: false };
    }
    await admin.from('media_package_history').insert({
      media_package_id: opts.mpId,
      action: opts.action,
      entity_id: opts.entity_id ?? null,
      new_value: { to, subject: opts.subject } as any,
    });
    return { ok: true, to };
  } catch (e: any) {
    console.error('notifyStaff error', e?.message || e);
    return { ok: false };
  }
}

const SECTIONS: Record<string, { table: string; single: boolean }> = {
  root:      { table: 'media_packages',              single: true },
  services:  { table: 'media_package_services',      single: false },
  studio:    { table: 'media_package_studio_data',   single: true },
  devices:   { table: 'media_package_devices',       single: false },
  prices:    { table: 'media_package_prices',        single: false },
  contact:   { table: 'media_package_contact_data',  single: true },
  hours:     { table: 'media_package_opening_hours', single: false },
  treatments:{ table: 'media_package_treatments',    single: false },
  team:      { table: 'media_package_team_members',  single: false },
  branding:  { table: 'media_package_branding',      single: true },
  consents:  { table: 'media_package_consents',      single: false },
  files:     { table: 'media_package_files',         single: false },
};

async function getFull(mpId: string) {
  const out: any = {};
  const { data: root } = await admin.from('media_packages').select('*').eq('id', mpId).maybeSingle();
  if (!root) return null;
  out.root = root;
  for (const [key, cfg] of Object.entries(SECTIONS)) {
    if (key === 'root') continue;
    const { data } = await admin.from(cfg.table).select('*').eq('media_package_id', mpId).order('created_at', { ascending: true });
    out[key] = cfg.single ? (data?.[0] ?? null) : (data ?? []);
  }
  const progress = await admin.rpc('calc_media_package_progress', { _mp_id: mpId });
  out.progress = progress.data ?? 0;
  return out;
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || (await (async () => {
      try { return (await req.clone().json())?.action; } catch { return null; }
    })());

    // Staff issue-token endpoint (requires authenticated staff)
    if (action === 'issue_token') {
      const auth = req.headers.get('Authorization');
      if (!auth) return json({ error: 'unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: auth } }, auth: { persistSession: false }
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: 'unauthorized' }, 401);
      const { data: canManage } = await admin.rpc('can_manage_media_packages').single().then(r => r).catch(() => ({ data: null }));
      // fallback: check via user client (RLS)
      const body = await req.json();
      const mpId = body.mp_id;
      if (!mpId) return json({ error: 'mp_id required' }, 400);
      // Ensure user can access it
      const { data: mp } = await userClient.from('media_packages').select('id').eq('id', mpId).maybeSingle();
      if (!mp) return json({ error: 'forbidden' }, 403);
      const token = await signToken(mpId);
      return json({ token, url: `/book/mediapaket?token=${encodeURIComponent(token)}` });
    }

    // Staff notify-customer endpoint: sends email with wizard link
    if (action === 'notify_customer') {
      const auth = req.headers.get('Authorization');
      if (!auth) return json({ error: 'unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: auth } }, auth: { persistSession: false }
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: 'unauthorized' }, 401);
      const body = await req.json();
      const mpId = body.mp_id;
      const subject = body.subject || 'Ihr Media Paket bei Alix Lasers';
      const introMessage = body.message || 'Sie können Ihre Angaben jetzt online ausfüllen.';
      const baseUrl = body.base_url || 'https://alixwork.de';
      if (!mpId) return json({ error: 'mp_id required' }, 400);
      const { data: mp } = await userClient.from('media_packages')
        .select('id, customer_id').eq('id', mpId).maybeSingle();
      if (!mp) return json({ error: 'forbidden' }, 403);
      const { data: cust } = await admin.from('customers')
        .select('email, name').eq('id', mp.customer_id).maybeSingle();
      if (!cust?.email) return json({ error: 'customer has no email' }, 400);
      const token = await signToken(mpId);
      const link = `${baseUrl}/book/mediapaket?token=${encodeURIComponent(token)}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; color:#222">
          <h2 style="color:#111">Ihr Media Paket</h2>
          <p>Hallo ${cust.name || ''},</p>
          <p>${introMessage.replace(/\n/g, '<br>')}</p>
          <p style="margin: 24px 0">
            <a href="${link}" style="background:#000;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
              Media Paket öffnen
            </a>
          </p>
          <p style="font-size:12px;color:#666">Falls der Button nicht funktioniert:<br><a href="${link}">${link}</a></p>
          <p style="font-size:12px;color:#666">Der Link ist personalisiert – bitte nicht weitergeben.</p>
        </div>`;
      // Delegate to shared mailer with staff auth
      const { error: sendErr } = await userClient.functions.invoke('send-mail', {
        body: { to: cust.email, subject, html, from: 'vertrieb@alixwork.de' },
      });
      if (sendErr) return json({ error: sendErr.message }, 502);
      await admin.from('media_package_history').insert({
        media_package_id: mpId,
        user_id: userData.user.id,
        action: 'customer_link_sent',
        new_value: { email: cust.email, subject } as any,
      });
      // Status invited → in_progress-ähnlich: keep or bump if not_started
      await admin.from('media_packages')
        .update({ status: 'in_progress' as any })
        .eq('id', mpId).eq('status', 'not_started');
      return json({ ok: true, email: cust.email });
    }

    // Staff notify-question endpoint: sends question email to customer
    if (action === 'notify_question') {
      const auth = req.headers.get('Authorization');
      if (!auth) return json({ error: 'unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: auth } }, auth: { persistSession: false }
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: 'unauthorized' }, 401);
      const body = await req.json();
      const mpId = body.mp_id;
      const commentId = body.comment_id;
      const baseUrl = body.base_url || 'https://alixwork.de';
      if (!mpId || !commentId) return json({ error: 'mp_id and comment_id required' }, 400);
      const { data: mp } = await userClient.from('media_packages')
        .select('id, customer_id').eq('id', mpId).maybeSingle();
      if (!mp) return json({ error: 'forbidden' }, 403);
      const { data: cust } = await admin.from('customers')
        .select('email, name').eq('id', mp.customer_id).maybeSingle();
      if (!cust?.email) return json({ error: 'customer has no email' }, 400);
      const { data: comment } = await admin.from('media_package_comments')
        .select('subject, comment').eq('id', commentId).eq('media_package_id', mpId).maybeSingle();
      if (!comment) return json({ error: 'comment not found' }, 404);
      const token = await signToken(mpId);
      const link = `${baseUrl}/book/mediapaket?token=${encodeURIComponent(token)}`;
      const subject = comment.subject ? `Rückfrage: ${comment.subject}` : 'Rückfrage zu Ihrem Media Paket';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; color:#222">
          <h2 style="color:#111">Wir haben eine Rückfrage</h2>
          <p>Hallo ${cust.name || ''},</p>
          <p>zu Ihrem Media Paket haben wir folgende Rückfrage:</p>
          <blockquote style="border-left:3px solid #d4af37;padding:8px 12px;background:#faf7ee;margin:16px 0;white-space:pre-wrap">${String(comment.comment).replace(/</g,'&lt;')}</blockquote>
          <p style="margin: 24px 0">
            <a href="${link}" style="background:#000;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
              Jetzt beantworten
            </a>
          </p>
          <p style="font-size:12px;color:#666">Falls der Button nicht funktioniert:<br><a href="${link}">${link}</a></p>
        </div>`;
      const { error: sendErr } = await userClient.functions.invoke('send-mail', {
        body: { to: cust.email, subject, html, from: 'vertrieb@alixwork.de' },
      });
      if (sendErr) return json({ error: sendErr.message }, 502);
      await admin.from('media_package_history').insert({
        media_package_id: mpId,
        user_id: userData.user.id,
        action: 'question_email_sent',
        entity_id: commentId,
        new_value: { email: cust.email, subject } as any,
      });
      return json({ ok: true, email: cust.email });
    }

    // All other actions are token-based (customer portal)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const token = body.token || url.searchParams.get('token');
    if (!token) return json({ error: 'token required' }, 401);
    const mpId = await verifyToken(token);
    if (!mpId) return json({ error: 'invalid token' }, 401);

    switch (action) {
      case 'get': {
        const data = await getFull(mpId);
        if (!data) return json({ error: 'not found' }, 404);
        return json({ mp_id: mpId, ...data });
      }

      case 'save_section': {
        const { section, values, row_id } = body;
        const cfg = SECTIONS[section];
        if (!cfg) return json({ error: 'unknown section' }, 400);

        if (section === 'root') {
          // Customer can only update limited fields
          const allowed = ['studio_name'];
          const patch: any = {};
          for (const k of allowed) if (k in (values || {})) patch[k] = values[k];
          if (Object.keys(patch).length) {
            await admin.from('media_packages').update(patch).eq('id', mpId);
          }
          return json({ ok: true });
        }

        const payload = { ...(values || {}), media_package_id: mpId };
        if (cfg.single) {
          // upsert on media_package_id
          const { data: existing } = await admin.from(cfg.table).select('id').eq('media_package_id', mpId).maybeSingle();
          if (existing) {
            const { error } = await admin.from(cfg.table).update(payload).eq('id', existing.id);
            if (error) return json({ error: error.message }, 400);
          } else {
            const { error } = await admin.from(cfg.table).insert(payload);
            if (error) return json({ error: error.message }, 400);
          }
        } else {
          if (row_id) {
            const { error } = await admin.from(cfg.table).update(payload).eq('id', row_id).eq('media_package_id', mpId);
            if (error) return json({ error: error.message }, 400);
          } else {
            const { error } = await admin.from(cfg.table).insert(payload);
            if (error) return json({ error: error.message }, 400);
          }
        }
        // Recalc progress
        const { data: p } = await admin.rpc('calc_media_package_progress', { _mp_id: mpId });
        await admin.from('media_packages').update({
          progress_percent: p ?? 0,
          status: 'in_progress',
        }).eq('id', mpId).eq('status', 'not_started');
        await admin.from('media_packages').update({ progress_percent: p ?? 0 }).eq('id', mpId);
        return json({ ok: true, progress: p ?? 0 });
      }

      case 'delete_row': {
        const { section, row_id } = body;
        const cfg = SECTIONS[section];
        if (!cfg || cfg.single) return json({ error: 'invalid' }, 400);
        await admin.from(cfg.table).delete().eq('id', row_id).eq('media_package_id', mpId);
        return json({ ok: true });
      }

      case 'sign_upload': {
        const { filename, category = 'Sonstiges' } = body;
        if (!filename) return json({ error: 'filename required' }, 400);
        const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const { data: mp } = await admin.from('media_packages').select('customer_id, order_id').eq('id', mpId).single();
        const path = `customers/${mp.customer_id}/orders/${mp.order_id ?? 'none'}/media-package/${mpId}/${category}/${Date.now()}_${safeName}`;
        const { data, error } = await admin.storage.from('mediapaket-files').createSignedUploadUrl(path);
        if (error) return json({ error: error.message }, 400);
        return json({ path, token: data.token, signedUrl: data.signedUrl });
      }

      case 'register_file': {
        const { path, category, original_filename, mime_type, file_size, description } = body;
        const { data: mp } = await admin.from('media_packages').select('customer_id, order_id').eq('id', mpId).single();
        const { data: row, error } = await admin.from('media_package_files').insert({
          media_package_id: mpId,
          customer_id: mp.customer_id,
          order_id: mp.order_id,
          category, original_filename, storage_path: path, mime_type, file_size, description,
        }).select('*').single();
        if (error) return json({ error: error.message }, 400);
        return json({ file: row });
      }

      case 'signed_download': {
        const { path } = body;
        const { data, error } = await admin.storage.from('mediapaket-files').createSignedUrl(path, 3600);
        if (error) return json({ error: error.message }, 400);
        return json({ url: data.signedUrl });
      }

      case 'submit': {
        await admin.from('media_packages').update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        }).eq('id', mpId);
        // Snapshot history
        const full = await getFull(mpId);
        await admin.from('media_package_history').insert({
          media_package_id: mpId,
          action: 'submitted',
          new_value: full as any,
        });
        await notifyStaff({
          mpId,
          subject: 'Mediapaket zur Freigabe eingereicht',
          headline: 'Kunde hat das Media Paket final eingereicht',
          innerHtml: `<p style="color:#333">Alle Angaben wurden vom Kunden bestätigt und freigegeben. Bitte prüfen und den Produktionsprozess anstoßen.</p>`,
          action: 'submit_email_sent',
          base_url: body.base_url,
        });
        return json({ ok: true });
      }

      case 'list_questions': {
        const { data, error } = await admin
          .from('media_package_comments')
          .select('id, subject, comment, related_field, created_at, read_at, answered_at, author_type, recipient_type, internal_only')
          .eq('media_package_id', mpId)
          .eq('internal_only', false)
          .order('created_at', { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json({ questions: data || [] });
      }

      case 'mark_read': {
        const { question_id } = body;
        if (!question_id) return json({ error: 'question_id required' }, 400);
        await admin.from('media_package_comments')
          .update({ read_at: new Date().toISOString() })
          .eq('id', question_id).eq('media_package_id', mpId).is('read_at', null);
        return json({ ok: true });
      }

      case 'answer_question': {
        const { question_id, answer } = body;
        if (!question_id || !answer?.trim()) return json({ error: 'question_id and answer required' }, 400);
        // Mark original as answered
        await admin.from('media_package_comments')
          .update({ answered_at: new Date().toISOString() })
          .eq('id', question_id).eq('media_package_id', mpId);
        // Insert customer reply
        const { data: parent } = await admin.from('media_package_comments')
          .select('subject, related_field, author_id').eq('id', question_id).maybeSingle();
        const answerText = String(answer).trim();
        await admin.from('media_package_comments').insert({
          media_package_id: mpId,
          author_type: 'customer',
          recipient_type: 'staff',
          subject: parent?.subject ? `Re: ${parent.subject}` : 'Antwort des Kunden',
          comment: answerText,
          related_field: parent?.related_field ?? null,
          internal_only: false,
        });
        await admin.from('media_package_history').insert({
          media_package_id: mpId,
          action: 'customer_answered',
          entity_id: question_id,
        });
        // Move back to in_progress so staff sees pending review
        await admin.from('media_packages').update({ status: 'in_progress' as any }).eq('id', mpId);

        // Notify staff by email (best-effort, don't fail on error)
        try {
          const { data: mp } = await admin.from('media_packages')
            .select('id, customer_id, order_id, studio_name, assigned_to').eq('id', mpId).maybeSingle();
          const { data: cust } = mp?.customer_id
            ? await admin.from('customers').select('name, email').eq('id', mp.customer_id).maybeSingle()
            : { data: null };
          // Recipient priority: original question author → assigned staff → default inbox
          const recipients = new Set<string>();
          const staffInbox = Deno.env.get('MEDIAPAKET_STAFF_INBOX') || 'vertrieb@alixwork.de';
          for (const uid of [parent?.author_id, (mp as any)?.assigned_to]) {
            if (!uid) continue;
            const { data: prof } = await admin.from('user_profiles').select('email').eq('id', uid).maybeSingle();
            if (prof?.email) recipients.add(prof.email);
          }
          if (recipients.size === 0) recipients.add(staffInbox);
          const studioLabel = (mp as any)?.studio_name || cust?.name || 'Kunde';
          const subject = parent?.subject
            ? `Kundenantwort: ${parent.subject} – ${studioLabel}`
            : `Kundenantwort im Media Paket – ${studioLabel}`;
          const orderLink = mp?.order_id
            ? `${(body.base_url || 'https://alixwork.de')}/orders/${mp.order_id}?tab=mediapaket`
            : `${(body.base_url || 'https://alixwork.de')}/`;
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; color:#222">
              <h2 style="color:#111">Kunde hat geantwortet</h2>
              <p><strong>${studioLabel}</strong>${cust?.email ? ` &lt;${cust.email}&gt;` : ''}</p>
              ${parent?.subject ? `<p style="color:#666">Betreff Rückfrage: ${String(parent.subject).replace(/</g,'&lt;')}</p>` : ''}
              <blockquote style="border-left:3px solid #d4af37;padding:8px 12px;background:#faf7ee;margin:16px 0;white-space:pre-wrap">${answerText.replace(/</g,'&lt;')}</blockquote>
              <p style="margin: 24px 0">
                <a href="${orderLink}" style="background:#000;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
                  Media Paket öffnen
                </a>
              </p>
              <p style="font-size:12px;color:#666"><a href="${orderLink}">${orderLink}</a></p>
            </div>`;
          const to = Array.from(recipients);
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-mail`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SERVICE_ROLE}`,
              apikey: SERVICE_ROLE,
            },
            body: JSON.stringify({ to, subject, html, from: 'vertrieb@alixwork.de' }),
          });
          if (!resp.ok) {
            const t = await resp.text();
            console.error('answer_question: send-mail failed', resp.status, t);
          } else {
            await admin.from('media_package_history').insert({
              media_package_id: mpId,
              action: 'answer_email_sent',
              entity_id: question_id,
              new_value: { to, subject } as any,
            });
          }
        } catch (e: any) {
          console.error('answer_question: notify staff error', e?.message || e);
        }

        return json({ ok: true });
      }

      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
