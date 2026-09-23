import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const INTERNAL_TO = 'buchhaltung@alix-operation.de'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const serials: string[] = Array.isArray(body?.serials) ? body.serials.filter((s: unknown) => typeof s === 'string') : []
    if (serials.length === 0) {
      return new Response(JSON.stringify({ error: 'serials required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    const { data: devices, error } = await admin
      .from('lager_devices')
      .select('serial_number, model_name, reserved_order_id')
      .in('serial_number', serials)
    if (error) throw error

    const orderIds = [...new Set((devices ?? []).map(d => d.reserved_order_id).filter(Boolean))] as string[]
    const { data: orders } = orderIds.length
      ? await admin.from('orders').select('id, order_number, customer_id').in('id', orderIds)
      : { data: [] as any[] }
    const custIds = [...new Set((orders ?? []).map(o => o.customer_id).filter(Boolean))] as string[]
    const { data: customers } = custIds.length
      ? await admin.from('customers').select('id, company_name, contact_name, email').in('id', custIds)
      : { data: [] as any[] }

    const orderById = new Map((orders ?? []).map(o => [o.id, o]))
    const custById = new Map((customers ?? []).map(c => [c.id, c]))

    const send = async (to: string, subject: string, text: string) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({
          recipientEmail: to,
          templateName: 'customer-shipping-notice',
          templateData: { subject, body: text },
          extraCc: to === INTERNAL_TO ? [] : [INTERNAL_TO],
        }),
      })
      const raw = await res.text()
      return { ok: res.ok, status: res.status, raw }
    }

    const results: any[] = []
    const summary: string[] = []

    for (const d of devices ?? []) {
      const order = d.reserved_order_id ? orderById.get(d.reserved_order_id) : null
      const cust = order?.customer_id ? custById.get(order.customer_id) : null
      const name = cust?.company_name || cust?.contact_name || '—'
      summary.push(`${d.serial_number} · ${d.model_name} · ${order?.order_number ?? 'ohne Auftrag'} · ${name}`)

      if (!cust?.email || !order) {
        results.push({ serial: d.serial_number, skipped: 'keine Kundenadresse/kein Auftrag' })
        continue
      }
      const subject = `Ihr Gerät ist eingetroffen – Auftrag ${order.order_number}`
      const text = [
        `Sehr geehrte/r ${cust.contact_name || name},`,
        '',
        `Ihr Gerät zu Auftrag ${order.order_number} ist bei uns im Lager eingetroffen und geprüft:`,
        '',
        `Modell: ${d.model_name}`,
        `Seriennummer: ${d.serial_number}`,
        '',
        'Den Liefertermin stimmen wir in Kürze persönlich mit Ihnen ab.',
        '',
        'Mit freundlichen Grüßen',
        'Ihr Alix-Lasers Team',
      ].join('\n')
      const r = await send(cust.email, subject, text)
      results.push({ serial: d.serial_number, to: cust.email, ...r })
    }

    const internal = await send(
      INTERNAL_TO,
      `Lagereingang – ${devices?.length ?? 0} Geräte auf Bestand gesetzt`,
      ['Folgende Geräte stehen jetzt auf Status „Bestand“:', '', ...summary].join('\n'),
    )
    results.push({ internal: true, to: INTERNAL_TO, ...internal })

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
