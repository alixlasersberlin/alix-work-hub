// Returns the signed PDF with an "Auftragsbestätigung" header stamped on page 1.
// Public access via signature_id + token (token of alix_sign_requests).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function decodePdf(raw: string): Uint8Array {
  if (raw.startsWith('\\x')) {
    const hex = raw.slice(2)
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
    return bytes
  }
  const bin = atob(raw)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
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

async function resolveOrderForSignature(admin: any, sig: any, req2: any): Promise<any | null> {
  const identifiers = orderIdentifiers(sig?.offer_number, req2?.offer_number)
  const identifierSet = new Set(identifiers.map((v) => v.toLowerCase()))

  if (req2?.customer_id) {
    const { data: customerOrders } = await admin
      .from('orders')
      .select('id, vat_display_mode, order_number, internal_number, case_number, created_at')
      .eq('customer_id', req2.customer_id)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const signatureId = url.searchParams.get('signature_id')
    const token = url.searchParams.get('token')
    const modeParam = (url.searchParams.get('mode') || '').toLowerCase()
    if (!signatureId || !token) {
      return new Response('signature_id and token required', { status: 400, headers: corsHeaders })
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(
      supabaseUrl,
      serviceKey,
    )

    const { data: sig } = await admin
      .from('alix_sign_signatures')
      .select('pdf_data, offer_number, sign_request_id')
      .eq('id', signatureId)
      .maybeSingle()
    if (!sig?.pdf_data) return new Response('Not found', { status: 404, headers: corsHeaders })

    const { data: req2 } = await admin
      .from('alix_sign_requests')
      .select('id, token, offer_number, customer_id')
      .eq('id', sig.sign_request_id)
      .maybeSingle()
    if (!req2 || req2.token !== token) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Signierte Alix-Sign-PDFs enthalten den Steuerstand vom Signaturzeitpunkt.
    // Wenn der Auftrag inzwischen auf Netto steht (oder explizit mode=netto kommt),
    // wird die AB aus aktuellen Auftragsdaten erzeugt, damit keine MwSt ausgewiesen wird.
    const linkedOrder = await resolveOrderForSignature(admin, sig, req2)
    const dbMode = linkedOrder?.vat_display_mode
    const effectiveMode = modeParam === 'netto' || modeParam === 'brutto'
      ? modeParam
      : (dbMode === 'netto' || dbMode === 'brutto' ? dbMode : null)

    if (effectiveMode === 'netto' && linkedOrder?.id) {
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

    const originalBytes = decodePdf(sig.pdf_data as unknown as string)
    const doc = await PDFDocument.load(originalBytes)
    const helvBold = await doc.embedFont(StandardFonts.HelveticaBold)
    const helv = await doc.embedFont(StandardFonts.Helvetica)

    // Security ID stamped on every page (SEC-{YEAR}-{8 HEX})
    const rndBuf = new Uint8Array(4)
    crypto.getRandomValues(rndBuf)
    const hex = Array.from(rndBuf).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const securityId = `SEC-${new Date().getFullYear()}-${hex}`

    const pages = doc.getPages()
    pages.forEach((p, idx) => {
      const { width, height } = p.getSize()
      if (idx === 0) {
        p.drawRectangle({
          x: 0,
          y: height - 18,
          width,
          height: 18,
          color: rgb(0.773, 0.631, 0.333),
        })
        p.drawText('AUFTRAGSBESTÄTIGUNG', {
          x: 18,
          y: height - 14,
          size: 11,
          font: helvBold,
          color: rgb(1, 1, 1),
        })
      }
      // Security ID top-left, just under the gold band so it stays readable
      p.drawText(securityId, {
        x: 18,
        y: height - (idx === 0 ? 30 : 14),
        size: 7,
        font: helv,
        color: rgb(0.55, 0.55, 0.55),
      })
    })

    const out = await doc.save()
    const filename = `auftragsbestaetigung-${sig.offer_number || 'auftrag'}.pdf`
    return new Response(out, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
