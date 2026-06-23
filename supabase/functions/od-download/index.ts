// Short-link proxy for order_documents.
// GET /functions/v1/od-download?t=<token>  ->  streams the file bytes
// (the user-visible URL stays on alixwork.de/d/<token>; no redirect to Supabase Storage)
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
      .select('file_path, file_name, file_type, document_type')
      .eq('download_token', token)
      .maybeSingle()
    if (error || !doc) {
      return new Response('Dokument nicht gefunden oder Link abgelaufen.', { status: 404, headers: corsHeaders })
    }

    // Direkt das Datei-Blob aus Storage laden und ausliefern.
    // Dadurch bleibt die URL auf alixwork.de/d/<token>; keine Weiterleitung zu *.supabase.co.
    const dl = await admin.storage.from('order-invoices').download(doc.file_path)
    if (dl.error || !dl.data) {
      return new Response('Download nicht verfügbar.', { status: 500, headers: corsHeaders })
    }

    const bytes = new Uint8Array(await dl.data.arrayBuffer())
    const contentType = doc.file_type || 'application/pdf'
    const safeName = (doc.file_name || 'dokument.pdf').replace(/[\r\n"]/g, '_')

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (e) {
    return new Response('Fehler: ' + (e?.message ?? 'unbekannt'), { status: 500, headers: corsHeaders })
  }
})
