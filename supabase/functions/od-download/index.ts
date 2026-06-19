// Short-link redirector for order_documents.
// GET /functions/v1/od-download?t=<token>  ->  302 to a freshly signed Storage URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('t')
    if (!token || token.length < 6) {
      return new Response('Ungültiger Link', { status: 400, headers: corsHeaders })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: doc, error } = await admin
      .from('order_documents')
      .select('file_path, file_name, document_type')
      .eq('download_token', token)
      .maybeSingle()
    if (error || !doc) {
      return new Response('Dokument nicht gefunden oder Link abgelaufen.', { status: 404, headers: corsHeaders })
    }

    const { data: signed, error: signErr } = await admin.storage
      .from('order-invoices')
      .createSignedUrl(doc.file_path, 60 * 5, { download: doc.file_name ?? true })
    if (signErr || !signed?.signedUrl) {
      return new Response('Download nicht verfügbar.', { status: 500, headers: corsHeaders })
    }

    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: signed.signedUrl } })
  } catch (e) {
    return new Response('Fehler: ' + (e?.message ?? 'unbekannt'), { status: 500, headers: corsHeaders })
  }
})
