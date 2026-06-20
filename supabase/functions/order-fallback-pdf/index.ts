// Generates an "Auftragsbestätigung" PDF using vorlage-5.pdf as background and the
// related offer payload (same data as the original Angebot). Falls back to order data
// when no matching offer exists.
// Public access via order_id + HMAC token derived from SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const TEMPLATE_URL =
  'https://alixwork.de/__l5e/assets-v1/c17cc41b-a312-47e7-97a3-df02295e3420/auftragsbestaetigung-template.pdf'

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

const fmt = (n: number, currency = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(Number(n) || 0)

function addrLines(a: any): string[] {
  if (!a || typeof a !== 'object') return []
  const street = a.street || a.address || a.address1 || ''
  const street2 = a.street2 || a.address2 || ''
  const zip = a.zip || a.postal_code || a.postcode || ''
  const city = a.city || ''
  const country = a.country || a.country_name || ''
  return [a.attention, a.company || a.name, street, street2, [zip, city].filter(Boolean).join(' '), country].filter(
    Boolean,
  )
}

let templateCache: Uint8Array | null = null
async function loadTemplate(): Promise<Uint8Array | null> {
  if (templateCache) return templateCache
  try {
    const res = await fetch(TEMPLATE_URL)
    if (!res.ok) return null
    templateCache = new Uint8Array(await res.arrayBuffer())
    return templateCache
  } catch {
    return null
  }
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

    const { data: orderItems } = await admin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('item_order', { ascending: true })

    const { data: customer } = order.customer_id
      ? await admin
          .from('customers')
          .select('company_name, contact_name, email, phone, billing_address, shipping_address')
          .eq('id', order.customer_id)
          .maybeSingle()
      : { data: null as any }

    // Resolve the related offer (same data source as the original Angebot)
    let offer: any = null
    if (order.case_number) {
      const { data } = await admin.from('offers').select('*').eq('case_number', order.case_number).maybeSingle()
      offer = data
    }
    if (!offer && order.customer_id) {
      const { data } = await admin
        .from('offers')
        .select('*')
        .eq('customer_id', order.customer_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      offer = data
    }
    const payload: any = (offer?.payload as any) || {}

    // Aggregate snapshot equivalent to the Angebot snapshot
    const lines: any[] = Array.isArray(payload.lines) && payload.lines.length > 0
      ? payload.lines
      : (orderItems || []).map((it: any) => ({
          name: it.item_name,
          description: it.description,
          quantity: Number(it.quantity || 0),
          rate: Number(it.rate || 0),
          tax_percentage: 0,
        }))

    const currency = order.currency || 'EUR'
    const totals = payload.totals || {
      net: Number(offer?.total_net ?? 0) || Number(order.total_amount || 0),
      tax: Number(offer?.total_tax ?? 0),
      gross: Number(offer?.total_gross ?? 0) || Number(order.total_amount || 0),
    }
    const payment = payload.payment || { type: 'Direktkauf', price: totals.gross, down: 0, term: 0 }
    const cust = payload.customer || customer || {}
    const offerNumber = order.internal_number || order.order_number || order.id
    const offerDate = order.order_date || payload.offerDate || new Date().toISOString()

    // ----- Load template + build doc -----
    const templateBytes = await loadTemplate()
    const doc = await PDFDocument.create()
    const helv = await doc.embedFont(StandardFonts.Helvetica)
    const helvB = await doc.embedFont(StandardFonts.HelveticaBold)

    let templatePage: any = null
    if (templateBytes) {
      const tpl = await PDFDocument.load(templateBytes)
      ;[templatePage] = await doc.embedPdf(tpl, [0])
    }

    const PAGE_W = 595
    const PAGE_H = 842
    const LEFT = 110 // space for the blue gradient sidebar
    const RIGHT = PAGE_W - 36
    const headerBlue = rgb(0.078, 0.235, 0.431)
    const grey = rgb(0.4, 0.4, 0.4)
    const black = rgb(0.15, 0.15, 0.15)

    const newPage = () => {
      const p = doc.addPage([PAGE_W, PAGE_H])
      if (templatePage) {
        p.drawPage(templatePage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      }
      return p
    }

    let page = newPage()
    let y = PAGE_H - 60

    // Title
    page.drawText('Auftragsbestätigung', {
      x: LEFT, y, size: 20, font: helvB, color: headerBlue,
    })
    y -= 8
    page.drawLine({ start: { x: LEFT, y: y - 2 }, end: { x: RIGHT, y: y - 2 }, thickness: 0.6, color: headerBlue })
    y -= 18

    page.drawText(`Nr. ${offerNumber}`, { x: LEFT, y, size: 10, font: helv, color: grey })
    page.drawText(`Datum: ${new Date(offerDate).toLocaleDateString('de-DE')}`, { x: LEFT + 160, y, size: 10, font: helv, color: grey })
    if (order.case_number) {
      page.drawText(`Vorgang: ${order.case_number}`, { x: LEFT + 320, y, size: 10, font: helv, color: grey })
    }
    y -= 22

    // Customer block
    page.drawText('Kunde', { x: LEFT, y, size: 10, font: helvB, color: headerBlue })
    y -= 14
    const billing = cust.billing_address || order.billing_address || {}
    const custLines = [
      cust.company_name || cust.contact_name || '',
      cust.contact_name && cust.contact_name !== cust.company_name ? cust.contact_name : '',
      ...addrLines(billing),
      cust.email || '',
      cust.phone || '',
    ].filter(Boolean)
    for (const l of custLines) {
      page.drawText(String(l).slice(0, 80), { x: LEFT, y, size: 10, font: helv, color: black })
      y -= 12
    }
    y -= 10

    // Table header
    const cols = { idx: LEFT, name: LEFT + 22, qty: RIGHT - 250, rate: RIGHT - 190, tax: RIGHT - 110, sum: RIGHT - 70 }
    page.drawRectangle({ x: LEFT - 4, y: y - 4, width: RIGHT - LEFT + 8, height: 16, color: rgb(0.72, 0.85, 1) })
    page.drawText('#', { x: cols.idx, y, size: 9, font: helvB, color: headerBlue })
    page.drawText('Position', { x: cols.name, y, size: 9, font: helvB, color: headerBlue })
    page.drawText('Menge', { x: cols.qty, y, size: 9, font: helvB, color: headerBlue })
    page.drawText('Preis', { x: cols.rate, y, size: 9, font: helvB, color: headerBlue })
    page.drawText('MwSt', { x: cols.tax, y, size: 9, font: helvB, color: headerBlue })
    page.drawText('Summe', { x: cols.sum, y, size: 9, font: helvB, color: headerBlue })
    y -= 16

    const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

    let i = 1
    for (const l of lines) {
      if (y < 140) {
        page = newPage()
        y = PAGE_H - 60
      }
      const name = String(l.name || l.item_name || '')
      const desc = String(l.description || '')
      const qty = Number(l.quantity ?? 1)
      const rate = Number(l.rate ?? 0)
      const taxPct = Number(l.tax_percentage ?? 0)
      const sum = qty * rate
      page.drawText(String(i++), { x: cols.idx, y, size: 9, font: helv, color: black })
      page.drawText(truncate(name, 45), { x: cols.name, y, size: 9, font: helvB, color: black })
      page.drawText(String(qty), { x: cols.qty, y, size: 9, font: helv, color: black })
      page.drawText(fmt(rate, currency), { x: cols.rate, y, size: 9, font: helv, color: black })
      page.drawText(`${taxPct}%`, { x: cols.tax, y, size: 9, font: helv, color: black })
      page.drawText(fmt(sum, currency), { x: cols.sum, y, size: 9, font: helv, color: black })
      y -= 12
      if (desc && desc !== name) {
        // Wrap description
        const words = desc.split(/\s+/)
        let line = ''
        const flush = () => {
          if (!line) return
          page.drawText(truncate(line, 90), { x: cols.name, y, size: 8, font: helv, color: grey })
          y -= 10
          line = ''
        }
        for (const w of words) {
          if ((line + ' ' + w).length > 90) flush()
          line = line ? line + ' ' + w : w
        }
        flush()
      }
      page.drawLine({ start: { x: LEFT - 4, y: y + 4 }, end: { x: RIGHT, y: y + 4 }, thickness: 0.2, color: rgb(0.85, 0.85, 0.85) })
      y -= 4
    }

    // Totals
    if (y < 120) { page = newPage(); y = PAGE_H - 80 }
    y -= 10
    const lblX = RIGHT - 160
    page.drawText('Netto:', { x: lblX, y, size: 10, font: helv, color: black })
    page.drawText(fmt(totals.net, currency), { x: RIGHT - 60, y, size: 10, font: helv, color: black })
    y -= 14
    page.drawText('MwSt:', { x: lblX, y, size: 10, font: helv, color: black })
    page.drawText(fmt(totals.tax, currency), { x: RIGHT - 60, y, size: 10, font: helv, color: black })
    y -= 16
    page.drawText('Gesamt:', { x: lblX, y, size: 12, font: helvB, color: headerBlue })
    page.drawText(fmt(totals.gross, currency), { x: RIGHT - 60, y, size: 12, font: helvB, color: headerBlue })
    y -= 24

    // Payment block
    if (y < 100) { page = newPage(); y = PAGE_H - 80 }
    page.drawText(`Zahlung: ${payment.type || 'Direktkauf'}`, { x: LEFT, y, size: 10, font: helvB, color: headerBlue })
    y -= 14
    const price = Number(payment.price) || Number(totals.gross) || 0
    const down = Number(payment.down) || 0
    const term = Number(payment.term) || 0
    const base = Math.max(0, price - down)
    if (!payment.type || payment.type === 'Direktkauf') {
      if (down > 0) { page.drawText(`Anzahlung: ${fmt(down, currency)}`, { x: LEFT, y, size: 10, font: helv, color: black }); y -= 12 }
      page.drawText(`Einmalzahlung: ${fmt(base > 0 ? base : totals.gross, currency)}`, { x: LEFT, y, size: 10, font: helv, color: black }); y -= 12
    } else {
      if (down > 0) { page.drawText(`Anzahlung: ${fmt(down, currency)}`, { x: LEFT, y, size: 10, font: helv, color: black }); y -= 12 }
      page.drawText(`Basis: ${fmt(base, currency)}`, { x: LEFT, y, size: 10, font: helv, color: black }); y -= 12
      page.drawText(`Laufzeit: ${term} Monate`, { x: LEFT, y, size: 10, font: helv, color: black }); y -= 12
      const rate = term > 0 ? base / term : 0
      page.drawText(`Monatliche Rate: ${fmt(rate, currency)}`, { x: LEFT, y, size: 10, font: helv, color: black }); y -= 12
    }

    if (payload.notes) {
      y -= 8
      page.drawText('Hinweise:', { x: LEFT, y, size: 10, font: helvB, color: headerBlue }); y -= 12
      for (const ln of String(payload.notes).split('\n')) {
        page.drawText(truncate(ln, 95), { x: LEFT, y, size: 9, font: helv, color: black }); y -= 11
      }
    }

    // Footer + security id
    const rndBuf = new Uint8Array(4); crypto.getRandomValues(rndBuf)
    const hex = Array.from(rndBuf).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const securityId = `SEC-${new Date().getFullYear()}-${hex}`
    const pages = doc.getPages()
    pages.forEach((p, idx) => {
      p.drawText(`Auftragsbestätigung ${offerNumber} · Seite ${idx + 1} von ${pages.length} · ${securityId}`, {
        x: LEFT, y: 24, size: 7, font: helv, color: grey,
      })
    })

    const out = await doc.save()
    return new Response(out, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="auftragsbestaetigung-${offerNumber}.pdf"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
