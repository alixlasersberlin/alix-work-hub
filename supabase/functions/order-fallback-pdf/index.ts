// Generates an "Auftragsbestätigung" PDF directly from order data (no Alix Sign signature required).
// Public access via order_id + HMAC token derived from SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function signOrderToken(orderId: string, secret: string): Promise<string> {
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

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(n || 0)
}

function addrLines(a: any): string[] {
  if (!a || typeof a !== 'object') return []
  const street = a.street || a.address || a.address1 || ''
  const street2 = a.street2 || a.address2 || ''
  const zip = a.zip || a.postal_code || a.postcode || ''
  const city = a.city || ''
  const country = a.country || a.country_name || ''
  return [a.attention, a.company || a.name, street, street2, [zip, city].filter(Boolean).join(' '), country].filter(Boolean)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const orderId = url.searchParams.get('order_id')
    const token = url.searchParams.get('token')
    if (!orderId || !token) return new Response('order_id and token required', { status: 400, headers: corsHeaders })

    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const expected = await signOrderToken(orderId, secret)
    if (expected !== token) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, secret)
    const { data: order } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle()
    if (!order) return new Response('Order not found', { status: 404, headers: corsHeaders })
    const { data: items } = await admin.from('order_items').select('*').eq('order_id', orderId).order('item_order', { ascending: true })
    const { data: customer } = order.customer_id
      ? await admin.from('customers').select('company_name, contact_name, email, billing_address, shipping_address').eq('id', order.customer_id).maybeSingle()
      : { data: null as any }

    const doc = await PDFDocument.create()
    const helv = await doc.embedFont(StandardFonts.Helvetica)
    const helvB = await doc.embedFont(StandardFonts.HelveticaBold)
    let page = doc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()
    const gold = rgb(0.773, 0.631, 0.333)
    const black = rgb(0, 0, 0)
    const grey = rgb(0.4, 0.4, 0.4)

    // Header band
    page.drawRectangle({ x: 0, y: height - 24, width, height: 24, color: gold })
    page.drawText('AUFTRAGSBESTÄTIGUNG', { x: 24, y: height - 17, size: 13, font: helvB, color: rgb(1, 1, 1) })

    let y = height - 60
    page.drawText('Alix Lasers GmbH', { x: 24, y, size: 11, font: helvB, color: black }); y -= 14
    page.drawText('alixlasers.com', { x: 24, y, size: 9, font: helv, color: grey }); y -= 24

    // Customer block (right side)
    const custStart = height - 60
    let cy = custStart
    const cx = 320
    page.drawText('Kunde', { x: cx, y: cy, size: 9, font: helvB, color: grey }); cy -= 12
    const billing = (customer?.billing_address as any) || (order.billing_address as any) || {}
    const lines = [customer?.company_name || customer?.contact_name || '', ...addrLines(billing)].filter(Boolean)
    for (const l of lines) { page.drawText(String(l).slice(0, 60), { x: cx, y: cy, size: 9, font: helv, color: black }); cy -= 11 }
    if (customer?.email) { page.drawText(customer.email, { x: cx, y: cy, size: 9, font: helv, color: grey }); cy -= 11 }

    y = Math.min(y, cy) - 10

    // Meta block
    const orderNumber = order.internal_number || order.order_number || order.id
    const dateStr = order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')
    page.drawText(`Auftrag: ${orderNumber}`, { x: 24, y, size: 10, font: helvB, color: black })
    page.drawText(`Datum: ${dateStr}`, { x: 320, y, size: 10, font: helv, color: black })
    y -= 30

    // Table header
    const cols = { name: 24, qty: 340, rate: 400, total: 480 }
    page.drawLine({ start: { x: 24, y: y + 14 }, end: { x: width - 24, y: y + 14 }, thickness: 0.5, color: grey })
    page.drawText('Position', { x: cols.name, y, size: 9, font: helvB, color: black })
    page.drawText('Menge', { x: cols.qty, y, size: 9, font: helvB, color: black })
    page.drawText('Einzelpreis', { x: cols.rate, y, size: 9, font: helvB, color: black })
    page.drawText('Gesamt', { x: cols.total, y, size: 9, font: helvB, color: black })
    y -= 6
    page.drawLine({ start: { x: 24, y }, end: { x: width - 24, y }, thickness: 0.5, color: grey })
    y -= 14

    const currency = order.currency || 'EUR'
    let net = 0
    for (const it of items || []) {
      if (y < 120) { page = doc.addPage([595, 842]); y = page.getSize().height - 60 }
      const name = String(it.item_name || it.description || '').slice(0, 60)
      const qty = Number(it.quantity || 0)
      const rate = Number(it.rate || 0)
      const total = Number(it.amount ?? qty * rate)
      net += total
      page.drawText(name, { x: cols.name, y, size: 9, font: helv, color: black })
      page.drawText(String(qty), { x: cols.qty, y, size: 9, font: helv, color: black })
      page.drawText(fmt(rate, currency), { x: cols.rate, y, size: 9, font: helv, color: black })
      page.drawText(fmt(total, currency), { x: cols.total, y, size: 9, font: helv, color: black })
      y -= 14
      if (it.description && it.description !== it.item_name) {
        page.drawText(String(it.description).slice(0, 90), { x: cols.name + 6, y, size: 8, font: helv, color: grey })
        y -= 12
      }
    }

    y -= 6
    page.drawLine({ start: { x: 320, y }, end: { x: width - 24, y }, thickness: 0.5, color: grey })
    y -= 16
    const total = Number(order.total_amount ?? net)
    page.drawText('Gesamtbetrag', { x: 340, y, size: 10, font: helvB, color: black })
    page.drawText(fmt(total, currency), { x: cols.total, y, size: 10, font: helvB, color: black })

    // Footer note + security id
    const rndBuf = new Uint8Array(4); crypto.getRandomValues(rndBuf)
    const hex = Array.from(rndBuf).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const securityId = `SEC-${new Date().getFullYear()}-${hex}`
    page.drawText(`Diese Auftragsbestätigung wurde elektronisch erstellt · ${securityId}`, {
      x: 24, y: 40, size: 7, font: helv, color: grey,
    })

    const out = await doc.save()
    return new Response(out, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="auftragsbestaetigung-${orderNumber}.pdf"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
