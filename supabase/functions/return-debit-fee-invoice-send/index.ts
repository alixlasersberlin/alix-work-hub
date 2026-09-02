import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const BCC = 'k.trinh@alix-lasers.com'
const de = (d: Date) => d.toLocaleDateString('de-DE')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const secret = req.headers.get('x-cron-secret') ?? ''
  const allowed = [Deno.env.get('CRON_SECRET'), Deno.env.get('RD_FEE_INVOICE_KEY')].filter(Boolean)
  if (!secret || !allowed.includes(secret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(url, serviceKey)

  try {
    const body = await req.json().catch(() => ({}))
    const id = body?.returnDebitId
    if (!id) {
      return new Response(JSON.stringify({ error: 'returnDebitId fehlt' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rd } = await supabase.from('bank_return_debits').select('*').eq('id', id).maybeSingle()
    if (!rd) throw new Error('Rücklastschrift nicht gefunden')

    const { data: inv } = await supabase
      .from('zoho_invoices')
      .select('id, invoice_number, invoice_date, due_date, currency, total, customer_name, payment_status, raw_data')
      .eq('zoho_invoice_id', `rd-fee-${id}`)
      .maybeSingle()
    if (!inv) throw new Error('Gebührenrechnung nicht gefunden')

    let recipient: string | null = body?.recipientEmail ?? (inv as any).raw_data?.email ?? null
    let customerName = (inv as any).customer_name ?? ''
    if (!recipient && rd.customer_id) {
      const { data: c } = await supabase.from('customers')
        .select('company_name, contact_name, email').eq('id', rd.customer_id).maybeSingle()
      customerName = customerName || (c as any)?.company_name || (c as any)?.contact_name || ''
      recipient = (c as any)?.email ?? null
    }
    if (!recipient) throw new Error('Kein E-Mail-Empfänger ermittelbar')

    // PDF-Token sicherstellen (ältere Gebührenrechnungen haben noch keinen)
    const raw = ((inv as any).raw_data ?? {}) as Record<string, unknown>
    let pdfToken = typeof raw.pdf_token === 'string' ? raw.pdf_token : ''
    if (!pdfToken) {
      pdfToken = crypto.randomUUID().replace(/-/g, '')
      await supabase.from('zoho_invoices')
        .update({ raw_data: { ...raw, pdf_token: pdfToken } })
        .eq('id', (inv as any).id)
    }
    const pdfUrl = `${url}/functions/v1/return-debit-fee-invoice-pdf?id=${id}&token=${pdfToken}`

    const res = await fetch(`${url}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        templateName: 'ruecklastschrift-gebuehrenrechnung',
        recipientEmail: recipient,
        idempotencyKey: `rd-fee-invoice-${id}-${Date.now()}`,
        templateData: {
          customerName,
          invoiceNumber: (inv as any).invoice_number,
          invoiceDate: de(new Date((inv as any).invoice_date)),
          dueDate: de(new Date((inv as any).due_date)),
          currency: (inv as any).currency || 'EUR',
          bankFee: Number((inv as any).raw_data?.bank_fee ?? 15),
          handlingFee: Number((inv as any).raw_data?.handling_fee ?? 30),
          total: Number((inv as any).total ?? 45),
          returnDate: rd.booking_date ? de(new Date(rd.booking_date)) : null,
          returnReason: rd.return_reason ?? null,
          originalInvoice: rd.invoice_number ?? null,
          pdfUrl,
        },
      }),
    })
    const text = await res.text()
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Versand fehlgeschlagen', status: res.status, details: text }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('bank_return_debits').update({
      fee_invoice_id: (inv as any).id,
      fee_invoice_number: (inv as any).invoice_number,
      fee_invoice_status: (inv as any).payment_status ?? 'offen',
      fee_invoice_total: Number((inv as any).total ?? 45),
      fee_invoice_sent_at: new Date().toISOString(),
    }).eq('id', id)

    return new Response(JSON.stringify({ success: true, recipient, bcc: BCC, invoice: (inv as any).invoice_number }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('return-debit-fee-invoice-send error:', e)
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
