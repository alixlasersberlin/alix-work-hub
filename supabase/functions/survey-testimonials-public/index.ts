// Öffentliche Testimonial-Ausspielung (Widget/Website) – nur freigegebene und veröffentlichte Zitate.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 12)));

    const { data } = await admin.from('survey_testimonials')
      .select('id, quote, author_name, company_name, allow_name, allow_company, published_at')
      .eq('status', 'freigegeben').not('published_at', 'is', null)
      .order('published_at', { ascending: false }).limit(limit);

    const items = (data ?? []).map((t) => ({
      id: t.id,
      quote: t.quote,
      author: t.allow_name ? t.author_name : null,
      company: t.allow_company ? t.company_name : null,
      published_at: t.published_at,
    }));

    return new Response(JSON.stringify({ items }), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
