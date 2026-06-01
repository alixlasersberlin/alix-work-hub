import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PUBLIC_BASE = 'https://alix-finance.de'
const TOKEN_TTL_DAYS = 90

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401)
    const userId = claims.claims.sub as string

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.order_id || '')
    const manual = Boolean(body?.manual)
    if (!orderId) return json({ error: 'order_id required' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // Super-Admin-Check für manuelle Versendung
    if (manual) {
      const { data: rolesRows } = await admin
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', userId)
      const roleNames = (rolesRows || []).map((r: any) => r.roles?.name).filter(Boolean)
      if (!roleNames.includes('Super Admin')) {
        return json({ error: 'Nur Super Admin darf manuell senden' }, 403)
      }
    }

    // Auftrag laden
    const { data: order, error: oErr } = await admin
      .from('orders')
      .select('id, order_number, customer_id, order_status, source_system')
      .eq('id', orderId)
      .maybeSingle()
    if (oErr || !order) return json({ error: 'Auftrag nicht gefunden' }, 404)

    // Kunde
    const { data: customer } = await admin
      .from('customers')
      .select('email, contact_name, company_name')
      .eq('id', order.customer_id)
      .maybeSingle()
    if (!customer?.email) {
      return json({ error: 'Kunde hat keine E-Mail-Adresse' }, 400)
    }
    const customerName = customer.contact_name || customer.company_name || ''

    // Produkt = erstes order_item
    const { data: items } = await admin
      .from('order_items')
      .select('item_name')
      .eq('order_id', orderId)
      .order('item_order', { ascending: true })
      .limit(1)
    const productName = items?.[0]?.item_name || null

    // Lieferdatum = letzter Status-Wechsel auf 'geliefert' oder jetzt
    const { data: history } = await admin
      .from('order_status_history')
      .select('created_at')
      .eq('order_id', orderId)
      .eq('new_status', 'geliefert')
      .order('created_at', { ascending: false })
      .limit(1)
    const deliveryDate = history?.[0]?.created_at || new Date().toISOString()

    const orderNumberDisplay = order.source_system === 'zoho_eu_2'
      ? `${order.order_number}-AT`
      : order.order_number

    // Existierender Review?
    const { data: existing } = await admin
      .from('reviews')
      .select('id, review_token, invitation_status, submitted_at')
      .eq('order_id', orderId)
      .maybeSingle()

    if (existing?.submitted_at) {
      return json({ error: 'Für diesen Auftrag wurde bereits eine Bewertung abgegeben' }, 409)
    }

    if (existing && !manual) {
      // Auto-Trigger sendet nicht doppelt
      return json({ ok: true, skipped: true, message: 'Bereits eingeladen' })
    }

    let reviewId = existing?.id as string | undefined
    let token = existing?.review_token as string | undefined

    if (!existing) {
      token = randomToken()
      const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data: inserted, error: insErr } = await admin
        .from('reviews')
        .insert({
          order_id: orderId,
          customer_id: order.customer_id,
          customer_name: customerName,
          customer_email: customer.email,
          order_number: orderNumberDisplay,
          product_name: productName,
          delivery_date: deliveryDate,
          review_token: token,
          token_expires_at: expiresAt,
          invitation_status: 'pending',
          status: 'open',
        })
        .select('id, review_token')
        .single()
      if (insErr) return json({ error: insErr.message }, 500)
      reviewId = inserted!.id
      token = inserted!.review_token
    }

    const reviewUrl = `${PUBLIC_BASE}/bewertung/${token}`

    // E-Mail versenden — über userClient, damit send-transactional-email
    // die User-Berechtigung (is_admin / can_manage_orders / …) prüfen kann.
    const { error: mailErr } = await userClient.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'review-invitation',
        recipientEmail: customer.email,
        idempotencyKey: `review-invite-${reviewId}-${manual ? 'manual' : 'auto'}-${Date.now()}`,
        templateData: {
          customerName,
          orderNumber: orderNumberDisplay,
          reviewUrl,
        },
      },
    })

    const sentType = manual ? 'manual' : 'automatic'
    const now = new Date().toISOString()

    const isRateLimit = !!mailErr && /429|rate.?limit|high demand/i.test(mailErr.message || '')

    await admin.from('reviews').update({
      invitation_status: mailErr ? (isRateLimit ? 'queued' : 'failed') : (existing ? 'resent' : 'sent'),
      invitation_sent_at: now,
      invitation_sent_by: userId,
    }).eq('id', reviewId)

    await admin.from('review_email_logs').insert({
      review_id: reviewId,
      order_id: orderId,
      customer_email: customer.email,
      sent_by: userId,
      sent_type: sentType,
      delivery_status: mailErr ? (isRateLimit ? 'queued' : 'failed') : 'queued',
      error_message: mailErr ? mailErr.message : null,
    })

    if (mailErr) {
      // 200 zurückgeben, damit der echte Grund im Frontend ankommt
      // (supabase-js verschluckt Bodies bei non-2xx Status)
      return json({
        ok: false,
        rate_limited: isRateLimit,
        error: isRateLimit
          ? 'E-Mail-Dienst überlastet (429). Bitte in einer Minute erneut versuchen.'
          : mailErr.message,
        review_id: reviewId,
        review_url: reviewUrl,
      }, 200)
    }
    return json({ ok: true, review_id: reviewId, review_url: reviewUrl })
  } catch (e: any) {
    return json({ error: e?.message || 'Unbekannter Fehler' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
