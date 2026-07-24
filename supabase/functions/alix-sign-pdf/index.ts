// Returns the signed PDF for a given sign_request_id (admin/internal use)
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

async function signOrderToken(orderId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`order-fallback:${orderId}`))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function orderIdentifiers(...values: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  for (const raw of values) {
    const v = String(raw || '').trim()
    if (!v) continue
    out.add(v)
    out.add(v.replace(/^(ANG|AB)[\s_-]*/i, '').trim())
  }
  return Array.from(out).filter(Boolean)
}

async function resolveOrderForSignature(admin: any, sig: any, request: any): Promise<any | null> {
  const identifiers = orderIdentifiers(sig?.offer_number, request?.offer_number)
  const identifierSet = new Set(identifiers.map((v) => v.toLowerCase()))

  if (request?.customer_id) {
    const { data: customerOrders } = await admin
      .from('orders')
      .select('id, vat_display_mode, order_number, internal_number, case_number, created_at')
      .eq('customer_id', request.customer_id)
      .order('created_at', { ascending: false })
      .limit(100)

    const match = (customerOrders || []).find((order: any) =>
      [order.order_number, order.internal_number, order.case_number]
        .filter(Boolean)
        .some((v: string) => identifierSet.has(String(v).toLowerCase())),
    )
    if (match) return match
  }

  for (const ident of identifiers) {
    for (const col of ['order_number', 'internal_number', 'case_number']) {
      const { data } = await admin
        .from('orders')
        .select('id, vat_display_mode, order_number, internal_number, case_number')
        .eq(col, ident)
        .maybeSingle()
      if (data) return data
    }
  }
  return null
}

async function renderNetOrderPdf(admin: any, supabaseUrl: string, serviceKey: string, sig: any, request: any): Promise<Response | null> {
  const linkedOrder = await resolveOrderForSignature(admin, sig, request)
  if (linkedOrder?.vat_display_mode !== 'netto' || !linkedOrder?.id) return null

  const fallbackToken = await signOrderToken(linkedOrder.id, serviceKey)
  const fallbackUrl = `${supabaseUrl}/functions/v1/order-fallback-pdf?order_id=${encodeURIComponent(linkedOrder.id)}&token=${fallbackToken}&mode=netto`
  const fallbackRes = await fetch(fallbackUrl)
  if (!fallbackRes.ok) {
    const msg = await fallbackRes.text().catch(() => 'Fallback PDF failed')
    return new Response(msg, { status: fallbackRes.status, headers: corsHeaders })
  }
  const out = await fallbackRes.arrayBuffer()
  const filename = `auftragsbestaetigung-${linkedOrder.order_number || linkedOrder.case_number || sig.offer_number || 'auftrag'}.pdf`
  return new Response(out, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, max-age=60',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = new URL(req.url)
  const requestId = url.searchParams.get('request_id')
  const signatureId = url.searchParams.get('signature_id')
  const publicToken = url.searchParams.get('token')

  if (signatureId && publicToken) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(
      supabaseUrl,
      serviceKey,
    )
    const { data: request } = await admin
      .from('alix_sign_requests')
      .select('id, token, expires_at, offer_number, customer_id')
      .eq('token', publicToken)
      .maybeSingle()

    if (!request) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: sig } = await admin
      .from('alix_sign_signatures')
      .select('pdf_data, offer_number, sign_request_id')
      .eq('id', signatureId)
      .eq('sign_request_id', request.id)
      .maybeSingle()

    if (!sig?.pdf_data) return new Response('Not found', { status: 404, headers: corsHeaders })

    const netPdf = await renderNetOrderPdf(admin, supabaseUrl, serviceKey, sig, request)
    if (netPdf) return netPdf

    let bytes: Uint8Array
    const raw = sig.pdf_data as unknown as string
    if (raw.startsWith('\\x')) {
      const hex = raw.slice(2)
      bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
    } else {
      const bin = atob(raw)
      bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${sig.offer_number || 'angebot'}-signiert.pdf"`,
      },
    })
  }

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data: ud, error: uerr } = await userClient.auth.getUser(auth.replace('Bearer ', ''))
  if (uerr || !ud?.user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  const { data: canUse } = await userClient.rpc('can_use_alix_sign')
  if (!canUse) return new Response('Forbidden', { status: 403, headers: corsHeaders })

  if (!requestId) return new Response('request_id required', { status: 400, headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: request } = await admin
    .from('alix_sign_requests')
    .select('id, offer_number, customer_id')
    .eq('id', requestId)
    .maybeSingle()
  const { data: sig } = await admin
    .from('alix_sign_signatures')
    .select('pdf_data, offer_number, sign_request_id')
    .eq('sign_request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!sig?.pdf_data) return new Response('Not found', { status: 404, headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const netPdf = await renderNetOrderPdf(admin, supabaseUrl, serviceKey, sig, request)
  if (netPdf) return netPdf

  // pdf_data comes back as base64-encoded string from PostgREST (bytea default 'hex' but JSON returns "\\x..." or base64 depending on supabase-js)
  // supabase-js returns bytea as base64-decoded? Actually it returns as base64 string. Normalize:
  let bytes: Uint8Array
  const raw = sig.pdf_data as unknown as string
  if (raw.startsWith('\\x')) {
    const hex = raw.slice(2)
    bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i*2, 2), 16)
  } else {
    const bin = atob(raw)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${sig.offer_number || 'angebot'}-signiert.pdf"`,
    },
  })
})
