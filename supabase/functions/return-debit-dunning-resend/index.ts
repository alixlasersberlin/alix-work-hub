import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const CC = ['k.trinh@alix-lasers.com']
const de = (d: Date) => d.toLocaleDateString('de-DE')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const secret = req.headers.get('x-cron-secret') ?? ''
  const allowed = [Deno.env.get('CRON_SECRET'), Deno.env.get('RETURN_DUNNING_RESEND_KEY')].filter(Boolean)
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
    const payDays = Number(body?.payDays ?? 7)
    if (!id) {
      return new Response(JSON.stringify({ error: 'returnDebitId fehlt' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rd, error: rdErr } = await supabase
      .from('bank_return_debits').select('*').eq('id', id).maybeSingle()
    if (rdErr || !rd) throw new Error(rdErr?.message || 'Rücklastschrift nicht gefunden')

    const { data: allocs } = await supabase
      .from('bank_return_debit_allocations').select('*').eq('return_debit_id', id)

    let customerName = ''
    let recipient: string | null = body?.recipientEmail ?? null
    if (!recipient && rd.customer_id) {
      const { data: c } = await supabase.from('customers')
        .select('company_name, contact_name, email').eq('id', rd.customer_id).maybeSingle()
      customerName = (c as any)?.company_name || (c as any)?.contact_name || ''
      recipient = (c as any)?.email ?? null
    }
    if (!recipient) {
      for (const a of allocs ?? []) {
        if (!a.invoice_id) continue
        let inv: any = (await supabase.from('zoho_invoices')
          .select('customer_id, customer_name, raw_data').eq('id', a.invoice_id).maybeSingle()).data
        if (!inv) {
          inv = (await supabase.from('zoho_recurring_invoices')
            .select('customer_id, customer_name, raw_data').eq('id', a.invoice_id).maybeSingle()).data
        }
        if (!inv) continue
        customerName = customerName || (inv.customer_name ?? '')
        recipient = typeof inv.raw_data?.email === 'string' ? inv.raw_data.email : null
        if (!recipient && inv.customer_id) {
          const { data: c2 } = await supabase.from('customers')
            .select('company_name, contact_name, email')
            .eq('external_customer_id', String(inv.customer_id)).maybeSingle()
          customerName = customerName || (c2 as any)?.company_name || (c2 as any)?.contact_name || ''
          recipient = (c2 as any)?.email ?? null
        }
        if (recipient) break
      }
    }
    if (!recipient) throw new Error('Kein E-Mail-Empfänger ermittelbar')

    let bank: any = null
    if (rd.bank_account_id) {
      bank = (await supabase.from('bank_accounts')
        .select('iban, bic, bank_name').eq('id', rd.bank_account_id).maybeSingle()).data
    }

    const amount = Number(rd.return_debit_amount || 0)
    const fee = Number(rd.customer_fee || 0)
    const due = new Date(); due.setDate(due.getDate() + payDays)
    const block = new Date(due); block.setDate(block.getDate() + 1)
    const items = (allocs ?? []).map((a: any) => ({
      invoice_number: a.invoice_number ?? null,
      amount: Number(a.allocated_amount || 0),
      due_date: null,
    }))

    const res = await fetch(`${url}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        templateName: 'ruecklastschrift-mahnung',
        recipientEmail: recipient,
        idempotencyKey: `ruecklastschrift-mahnung-${rd.id}-${Date.now()}`,
        templateData: {
          customerName,
          returnDate: rd.booking_date ? new Date(rd.booking_date).toLocaleDateString('de-DE') : null,
          returnReason: rd.return_reason ?? null,
          returnCode: rd.return_code ?? null,
          amount, fee, total: amount + fee,
          currency: rd.currency || 'EUR',
          payUntil: de(due), blockDate: de(block),
          mandateBlocked: !!rd.sepa_mandate_blocked,
          items,
          iban: bank?.iban ?? null,
          bic: bank?.bic ?? null,
          bankName: bank?.bank_name ?? null,
          reference: items[0]?.invoice_number ?? null,
        },
      }),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`send-transactional-email failed [${res.status}]: ${text}`)
      return new Response(JSON.stringify({ error: 'Versand fehlgeschlagen', status: res.status, details: text }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('bank_return_debits').update({
      status: 'mahnprozess',
      reminder_process_started: true,
      last_dunning_at: new Date().toISOString(),
    }).eq('id', rd.id)

    return new Response(JSON.stringify({ success: true, recipient, cc: CC, response: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('return-debit-dunning-resend error:', e)
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
