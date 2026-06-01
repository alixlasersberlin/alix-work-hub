import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function intInRange(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n) || n < lo || n > hi) return null
  return n
}

function clipText(v: unknown, max = 2000): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.slice(0, max)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '').trim()
    if (!token || token.length < 16) return json({ error: 'invalid_token' }, 400)

    const ratingDelivery = intInRange(body?.rating_delivery, 1, 5)
    const ratingDriver = intInRange(body?.rating_driver_friendliness, 1, 5)
    const trainingAnswer = ['ja', 'teilweise', 'nein'].includes(String(body?.training_answer))
      ? String(body.training_answer) : null
    const ratingTrainingText = clipText(body?.rating_training_text, 2000)
    const improvementText = clipText(body?.improvement_text, 4000)

    if (!ratingDelivery || !ratingDriver || !trainingAnswer) {
      return json({ error: 'missing_required_fields' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: review } = await admin
      .from('reviews')
      .select('id, submitted_at, status, token_expires_at')
      .eq('review_token', token)
      .maybeSingle()
    if (!review) return json({ error: 'invalid_token' }, 404)
    if (review.status === 'archived') return json({ error: 'invalid_token' }, 410)
    if (review.token_expires_at && new Date(review.token_expires_at) < new Date()) {
      return json({ error: 'expired' }, 410)
    }
    if (review.submitted_at) return json({ error: 'already_submitted' }, 409)

    const { error: upErr } = await admin
      .from('reviews')
      .update({
        rating_delivery: ratingDelivery,
        rating_driver_friendliness: ratingDriver,
        training_answer: trainingAnswer,
        rating_training_text: ratingTrainingText,
        improvement_text: improvementText,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
      })
      .eq('id', review.id)
      .is('submitted_at', null)
    if (upErr) return json({ error: upErr.message }, 500)

    return json({ ok: true })
  } catch (e: any) {
    return json({ error: e?.message || 'error' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
