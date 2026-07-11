// Mediapaket Reminders — daily cron
// - Sends reminder emails to customers with due dates within X days (in_progress/not_started)
// - Sends overdue alerts to assigned staff (or fallback inbox)
// Idempotent per day via media_package_history (action='reminder_sent_customer'|'overdue_alert_staff')

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN_SECRET = Deno.env.get('MEDIAPAKET_TOKEN_SECRET')!;
const STAFF_INBOX_FALLBACK = Deno.env.get('MEDIAPAKET_STAFF_INBOX') || 'vertrieb@alixwork.de';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function signToken(mpId: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(mpId));
  return `${b64url(enc.encode(mpId))}.${b64url(sig)}`;
}

async function sendMail(to: string | string[], subject: string, html: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-mail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
    body: JSON.stringify({ to, subject, html, from: 'vertrieb@alixwork.de' }),
  });
  if (!res.ok) console.error('send-mail failed', res.status, await res.text());
  return res.ok;
}

async function alreadyLoggedToday(mpId: string, action: string) {
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { data } = await admin.from('media_package_history')
    .select('id').eq('media_package_id', mpId).eq('action', action).gte('created_at', since.toISOString()).limit(1);
  return (data?.length ?? 0) > 0;
}

async function getSetting(key: string, def: string): Promise<string> {
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle();
  return (data as any)?.value ?? def;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const baseUrl = new URL(req.url).searchParams.get('base_url') || 'https://alixwork.de';

  const reminderDaysBefore = parseInt(await getSetting('mediapaket.reminder_days_before', '3')) || 3;

  // Load all active packages with a due_date
  const { data: mps, error } = await admin.from('media_packages')
    .select('id, customer_id, order_id, studio_name, due_date, status, assigned_user_id')
    .not('due_date', 'is', null)
    .not('status', 'in', '("completed","in_production","approval_pending")')
    .limit(1000);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  let customerSent = 0, staffSent = 0;
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  for (const mp of mps || []) {
    const due = new Date((mp as any).due_date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

    // Customer reminder (only if not submitted)
    const isPreSubmit = ['not_started', 'in_progress', 'question_required', 'customer_correction'].includes((mp as any).status);
    if (isPreSubmit && diffDays >= 0 && diffDays <= reminderDaysBefore) {
      const action = 'reminder_sent_customer';
      if (!(await alreadyLoggedToday(mp.id, action))) {
        const { data: cust } = await admin.from('customers').select('email, name').eq('id', (mp as any).customer_id).maybeSingle();
        if (cust?.email) {
          const token = await signToken(mp.id);
          const link = `${baseUrl}/book/mediapaket?token=${encodeURIComponent(token)}`;
          const subject = diffDays === 0 ? 'Heute ist Ihre Media-Paket-Frist' : `Erinnerung: Media Paket in ${diffDays} Tag${diffDays === 1 ? '' : 'en'} fällig`;
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">
              <h2 style="color:#111">Freundliche Erinnerung</h2>
              <p>Hallo ${cust.name || ''},</p>
              <p>Ihr Media Paket ist am <strong>${due.toLocaleDateString('de-DE')}</strong> fällig. Bitte vervollständigen Sie Ihre Angaben, damit wir mit der Umsetzung starten können.</p>
              <p style="margin:24px 0">
                <a href="${link}" style="background:#000;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Jetzt fortsetzen</a>
              </p>
              <p style="font-size:12px;color:#666"><a href="${link}">${link}</a></p>
            </div>`;
          if (await sendMail(cust.email, subject, html)) {
            customerSent++;
            await admin.from('media_package_history').insert({ media_package_id: mp.id, action, new_value: { email: cust.email, days_before: diffDays } as any });
          }
        }
      }
    }

    // Staff overdue alert
    if (diffDays < 0 && (mp as any).status !== 'completed') {
      const action = 'overdue_alert_staff';
      if (!(await alreadyLoggedToday(mp.id, action))) {
        const recipients = new Set<string>();
        if ((mp as any).assigned_user_id) {
          const { data: prof } = await admin.from('user_profiles').select('email').eq('id', (mp as any).assigned_user_id).maybeSingle();
          if (prof?.email) recipients.add(prof.email);
        }
        if (recipients.size === 0) recipients.add(STAFF_INBOX_FALLBACK);
        const overdueBy = Math.abs(diffDays);
        const link = `${baseUrl}/auftraege/${(mp as any).order_id}?tab=mediapaket`;
        const subject = `⚠ Mediapaket überfällig: ${(mp as any).studio_name || 'Kunde'} (seit ${overdueBy} Tag${overdueBy === 1 ? '' : 'en'})`;
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">
            <h2 style="color:#c00">Mediapaket überfällig</h2>
            <p><strong>${(mp as any).studio_name || 'Kunde'}</strong></p>
            <p>Frist war am <strong>${due.toLocaleDateString('de-DE')}</strong> (${overdueBy} Tag${overdueBy === 1 ? '' : 'e'} überfällig).</p>
            <p>Status: ${(mp as any).status}</p>
            <p style="margin:24px 0">
              <a href="${link}" style="background:#000;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Media Paket öffnen</a>
            </p>
          </div>`;
        if (await sendMail(Array.from(recipients), subject, html)) {
          staffSent++;
          await admin.from('media_package_history').insert({ media_package_id: mp.id, action, new_value: { to: Array.from(recipients), overdue_by: overdueBy } as any });
        }
      }
    }
  }

  // Phase 37 — Refresh-Reminder: 'completed' Pakete älter als X Monate erinnern
  const refreshMonths = parseInt(await getSetting('mediapaket.refresh_after_months', '12')) || 12;
  let refreshSent = 0;
  const refreshCutoff = new Date(); refreshCutoff.setMonth(refreshCutoff.getMonth() - refreshMonths);
  const { data: doneMps } = await admin.from('media_packages')
    .select('id, customer_id, studio_name, updated_at, submitted_at')
    .eq('status', 'completed')
    .lt('updated_at', refreshCutoff.toISOString())
    .limit(500);
  for (const mp of doneMps || []) {
    const action = 'refresh_reminder_sent';
    // Nur 1× pro 30 Tage
    const since30 = new Date(); since30.setDate(since30.getDate() - 30);
    const { data: recent } = await admin.from('media_package_history')
      .select('id').eq('media_package_id', mp.id).eq('action', action).gte('created_at', since30.toISOString()).limit(1);
    if (recent?.length) continue;
    if (!mp.customer_id) continue;
    const { data: cust } = await admin.from('customers').select('email, name').eq('id', mp.customer_id).maybeSingle();
    if (!cust?.email) continue;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">
      <h2>Zeit für ein Update?</h2>
      <p>Hallo ${cust.name || ''},</p>
      <p>Ihr Mediapaket ist inzwischen über ${refreshMonths} Monate alt. Möchten Sie es aktualisieren (neue Angebote, Team-Änderungen, neue Behandlungen)?</p>
      <p style="margin:24px 0"><a href="${baseUrl}/portal" style="background:#000;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Kontakt aufnehmen</a></p>
    </div>`;
    if (await sendMail(cust.email, 'Mediapaket-Refresh: Zeit für Aktualisierung?', html)) {
      refreshSent++;
      await admin.from('media_package_history').insert({
        media_package_id: mp.id, action, new_value: { email: cust.email, age_months: refreshMonths } as any,
      });
    }
  }

  // ===== Phase 43 — SLA-Eskalation =====
  // Konfig-Keys: mediapaket.sla.<status>_hours (z. B. mediapaket.sla.in_review_hours = 48)
  const SLA_STATUSES = ['in_review', 'approval_pending', 'in_production', 'question_required'];
  let slaEscalated = 0;
  const { data: slaSettings } = await admin.from('app_settings').select('key, value').like('key', 'mediapaket.sla.%');
  const slaHours: Record<string, number> = {};
  (slaSettings || []).forEach((r: any) => {
    const m = r.key.match(/^mediapaket\.sla\.(.+)_hours$/);
    if (m) slaHours[m[1]] = parseInt(r.value) || 0;
  });
  const { data: slaMps } = await admin.from('media_packages')
    .select('id, status, updated_at, assigned_user_id, studio_name, order_id, customer_id')
    .in('status', SLA_STATUSES).limit(500);
  for (const mp of slaMps || []) {
    const hrs = slaHours[(mp as any).status];
    if (!hrs) continue;
    const ageH = (now.getTime() - new Date((mp as any).updated_at).getTime()) / 3600000;
    if (ageH < hrs) continue;
    const action = 'sla_escalated';
    // 1× pro 24h
    const since24 = new Date(); since24.setDate(since24.getDate() - 1);
    const { data: recent } = await admin.from('media_package_history')
      .select('id').eq('media_package_id', mp.id).eq('action', action).gte('created_at', since24.toISOString()).limit(1);
    if (recent?.length) continue;
    // Super Admins ermitteln
    const { data: admins } = await admin.from('user_roles').select('user_id').eq('role', 'Super Admin');
    const adminIds = (admins || []).map((r: any) => r.user_id);
    const recipients = new Set<string>();
    for (const uid of adminIds) {
      const { data: prof } = await admin.from('user_profiles').select('email').eq('id', uid).maybeSingle();
      if (prof?.email) recipients.add(prof.email);
    }
    if ((mp as any).assigned_user_id) {
      const { data: prof } = await admin.from('user_profiles').select('email').eq('id', (mp as any).assigned_user_id).maybeSingle();
      if (prof?.email) recipients.add(prof.email);
    }
    if (recipients.size === 0) recipients.add(STAFF_INBOX_FALLBACK);
    const link = `${baseUrl}/auftraege/${(mp as any).order_id}?tab=mediapaket`;
    const subj = `⏰ SLA überschritten: ${(mp as any).studio_name || 'Kunde'} (${(mp as any).status})`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">
      <h2 style="color:#c60">SLA überschritten</h2>
      <p><strong>${(mp as any).studio_name || 'Kunde'}</strong></p>
      <p>Status: <strong>${(mp as any).status}</strong> seit ${Math.round(ageH)}h (SLA: ${hrs}h).</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#c60;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Öffnen</a></p>
    </div>`;
    if (await sendMail(Array.from(recipients), subj, html)) {
      slaEscalated++;
      await admin.from('media_package_history').insert({
        media_package_id: mp.id, action, new_value: { to: Array.from(recipients), status: (mp as any).status, age_hours: Math.round(ageH), sla_hours: hrs } as any,
      });
    }
  }

  // ===== Phase 47 — DSGVO Auto-Anonymisierung =====
  const anonMonths = parseInt(await getSetting('mediapaket.gdpr_anonymize_after_months', '0')) || 0;
  let anonymized = 0;
  if (anonMonths > 0) {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - anonMonths);
    const { data: oldMps } = await admin.from('media_packages')
      .select('id, updated_at, studio_name')
      .eq('status', 'completed')
      .lt('updated_at', cutoff.toISOString())
      .neq('studio_name', 'ANONYMISIERT')
      .limit(100);
    for (const mp of oldMps || []) {
      await admin.from('media_package_contact_data').update({
        contact_name: 'ANONYMISIERT', email: null, phone: null, mobile: null, whatsapp: null,
        secondary_email: null, website: null, instagram: null, facebook: null, tiktok: null, youtube: null, linkedin: null,
      } as any).eq('media_package_id', mp.id);
      await admin.from('media_package_team_members').update({
        first_name: 'ANONYMISIERT', last_name: null, biography: null,
      } as any).eq('media_package_id', mp.id);
      await admin.from('media_packages').update({ studio_name: 'ANONYMISIERT' }).eq('id', mp.id);
      await admin.from('media_package_history').insert({
        media_package_id: mp.id, action: 'anonymized_auto',
        new_value: { age_months: anonMonths, previous_name: (mp as any).studio_name } as any,
      });
      anonymized++;
    }
  }

  return new Response(JSON.stringify({ ok: true, checked: mps?.length || 0, customerSent, staffSent, refreshSent, slaEscalated, anonymized }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
