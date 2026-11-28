// ALIX SIGN PRO — Entity Sync
// Aktualisiert bei Signaturabschluss die passenden CRM-Ziel-Tabellen
// (orders, offers, repair_orders, maintenance_confirmations, finance_incoming_invoices).
// Aufruf: fire-and-forget aus sig-submit oder sig-webhook-dispatch.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireJobAccess } from '../_shared/job-auth.ts';
import { z } from 'npm:zod@3.25.76';

const ENTITY_TABLE_MAP: Record<string, string> = {
  order: 'orders',
  offer: 'offers',
  repair: 'repair_orders',
  service_report: 'repair_orders',
  maintenance: 'maintenance_confirmations',
  invoice: 'finance_incoming_invoices',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const denied = await requireJobAccess(req, corsHeaders);
    if (denied) return denied;
    const parsed = z.object({ document_id: z.string().uuid(), status: z.string().max(100).optional() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return new Response(JSON.stringify({ error: 'Invalid signature document' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { document_id } = parsed.data;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: doc, error: documentError } = await admin
      .from('sig_documents')
      .select('id, entity_type, entity_id, status, completed_at')
      .eq('id', document_id)
      .maybeSingle();
    if (documentError) throw documentError;

    if (!doc || !doc.entity_type || !doc.entity_id) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_entity' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const table = ENTITY_TABLE_MAP[doc.entity_type];
    if (!table) {
      return new Response(JSON.stringify({ ok: true, skipped: 'unknown_entity_type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const effectiveStatus = doc.status;
    if (effectiveStatus === 'signiert' && !doc.completed_at) return new Response(JSON.stringify({ error: 'Stored signature completion is missing' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const updates: Record<string, any> = {
      signature_status: effectiveStatus,
      signature_document_id: doc.id,
    };
    if (effectiveStatus === 'signiert') {
      updates.signature_signed_at = doc.completed_at;
    }

    const { error } = await admin.from(table).update(updates).eq('id', doc.entity_id);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, table, entity_id: doc.entity_id, status: effectiveStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('sig-entity-sync', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
