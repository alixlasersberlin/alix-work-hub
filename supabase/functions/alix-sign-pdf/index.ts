// Returns the signed PDF for a given sign_request_id (admin/internal use)
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

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

  const url = new URL(req.url)
  const requestId = url.searchParams.get('request_id')
  const signatureId = url.searchParams.get('signature_id')
  const publicToken = url.searchParams.get('token')

  if (signatureId && publicToken) {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: request } = await admin
      .from('alix_sign_requests')
      .select('id, token, expires_at')
      .eq('token', publicToken)
      .maybeSingle()

    if (!request) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: sig } = await admin
      .from('alix_sign_signatures')
      .select('pdf_data, offer_number')
      .eq('id', signatureId)
      .eq('sign_request_id', request.id)
      .maybeSingle()

    if (!sig?.pdf_data) return new Response('Not found', { status: 404, headers: corsHeaders })

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

  if (!requestId) return new Response('request_id required', { status: 400, headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: sig } = await admin
    .from('alix_sign_signatures')
    .select('pdf_data, offer_number')
    .eq('sign_request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!sig?.pdf_data) return new Response('Not found', { status: 404, headers: corsHeaders })

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
