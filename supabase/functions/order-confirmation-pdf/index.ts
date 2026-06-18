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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const signatureId = url.searchParams.get('signature_id')
    const token = url.searchParams.get('token')
    if (!signatureId || !token) {
      return new Response('signature_id and token required', { status: 400, headers: corsHeaders })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: sig } = await admin
      .from('alix_sign_signatures')
      .select('pdf_data, offer_number, sign_request_id')
      .eq('id', signatureId)
      .maybeSingle()
    if (!sig?.pdf_data) return new Response('Not found', { status: 404, headers: corsHeaders })

    const { data: req2 } = await admin
      .from('alix_sign_requests')
      .select('id, token')
      .eq('id', sig.sign_request_id)
      .maybeSingle()
    if (!req2 || req2.token !== token) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
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
