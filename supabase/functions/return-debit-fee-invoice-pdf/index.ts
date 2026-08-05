// Rendert die Gebührenrechnung einer Rücklastschrift als PDF.
// Öffentlicher Zugriff via ?id=<return_debit_id>&token=<pdf_token aus raw_data>
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const fmt = (n: number, currency = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(Number(n) || 0)
const de = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '–')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const u = new URL(req.url)
    const id = u.searchParams.get('id') ?? ''
    const token = u.searchParams.get('token') ?? ''
    if (!id || !token) {
      return new Response(JSON.stringify({ error: 'id und token erforderlich' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: inv } = await supabase
      .from('zoho_invoices')
      .select('invoice_number, invoice_date, due_date, currency, total, customer_name, reference_number, raw_data')
      .eq('source_system', 'internal')
      .eq('zoho_invoice_id', `rd-fee-${id}`)
      .maybeSingle()

    if (!inv) {
      return new Response(JSON.stringify({ error: 'Gebührenrechnung nicht gefunden' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const raw = (inv as any).raw_data ?? {}
    if (!raw.pdf_token || String(raw.pdf_token) !== token) {
      return new Response(JSON.stringify({ error: 'Ungültiger Token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rd } = await supabase
      .from('bank_return_debits')
      .select('booking_date, return_reason, invoice_number')
      .eq('id', id)
      .maybeSingle()

    const currency = (inv as any).currency || 'EUR'
    const bankFee = Number(raw.bank_fee ?? 15)
    const handlingFee = Number(raw.handling_fee ?? 30)
    const total = Number((inv as any).total ?? bankFee + handlingFee)

    const doc = await PDFDocument.create()
    const page = doc.addPage([595.28, 841.89])
    const helv = await doc.embedFont(StandardFonts.Helvetica)
    const helvB = await doc.embedFont(StandardFonts.HelveticaBold)
    const black = rgb(0.1, 0.1, 0.12)
    const grey = rgb(0.45, 0.45, 0.5)
    const gold = rgb(0.72, 0.58, 0.24)
    const LEFT = 56
    const RIGHT = 539
    let y = 780

    const text = (s: string, x: number, size = 10, font = helv, color = black) =>
      page.drawText(s, { x, y, size, font, color })

    text('Alix Lasers GmbH', LEFT, 14, helvB, gold)
    y -= 16
    text('Buchhaltung · notify.alixlasers.ai', LEFT, 9, helv, grey)
    y -= 40

    text('Gebührenrechnung nach Rücklastschrift', LEFT, 16, helvB)
    y -= 28

    text((inv as any).customer_name || '', LEFT, 11, helvB)
    y -= 26

    text(`Rechnungsnummer: ${(inv as any).invoice_number}`, LEFT)
    y -= 14
    text(`Rechnungsdatum: ${de((inv as any).invoice_date)}`, LEFT)
    y -= 14
    text(`Zahlbar bis: ${de((inv as any).due_date)}`, LEFT)
    y -= 14
    const orig = (rd as any)?.invoice_number || (inv as any).reference_number
    if (orig) { text(`Betroffene Rechnung: ${orig}`, LEFT); y -= 14 }
    if ((rd as any)?.booking_date) { text(`Rücklastschrift vom: ${de((rd as any).booking_date)}`, LEFT); y -= 14 }
    if ((rd as any)?.return_reason) { text(`Grund: ${String((rd as any).return_reason)}`, LEFT); y -= 14 }

    y -= 18
    page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 1, color: gold })
    y -= 20
    text('Position', LEFT, 10, helvB)
    page.drawText('Betrag', { x: RIGHT - 70, y, size: 10, font: helvB, color: black })
    y -= 18
    text('Bankgebühren Rücklastschrift', LEFT)
    page.drawText(fmt(bankFee, currency), { x: RIGHT - 70, y, size: 10, font: helv, color: black })
    y -= 16
    text('Bearbeitungsgebühr Rücklastschrift', LEFT)
    page.drawText(fmt(handlingFee, currency), { x: RIGHT - 70, y, size: 10, font: helv, color: black })
    y -= 14
    page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.5, color: grey })
    y -= 20
    text('Gesamtbetrag', LEFT, 12, helvB)
    page.drawText(fmt(total, currency), { x: RIGHT - 70, y, size: 12, font: helvB, color: black })

    y -= 40
    for (const ln of [
      'Bitte überweisen Sie den Betrag bis zum genannten Termin unter Angabe der',
      `Rechnungsnummer ${(inv as any).invoice_number}.`,
      'Die Gebühren werden als Verzugsschaden gemäß § 280 BGB berechnet und',
      'enthalten keine Umsatzsteuer.',
    ]) { text(ln, LEFT, 10, helv, black); y -= 14 }

    page.drawText(`${(inv as any).invoice_number} · erstellt am ${new Date().toLocaleDateString('de-DE')}`, {
      x: LEFT, y: 30, size: 7, font: helv, color: grey,
    })

    const out = await doc.save()
    return new Response(out, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${(inv as any).invoice_number}.pdf"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
