// Phase 11: Approval Action (approve / reject / dual-approve)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCallerAccess } from "../_shared/caller-access.ts";
import { approvalDecision } from "./decision.ts";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const access = await requireCallerAccess(req,corsHeaders);
    if ('response' in access) return access.response;
    const supabase = access.caller;
    const user = access.user;
    const parsed = z.object({approval_id:z.string().uuid(),action:z.enum(['approve','reject','cancel']),comment:z.string().max(2000).optional()}).safeParse(await req.json().catch(()=>({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { approval_id, action, comment } = parsed.data;

    const { data: appr, error: aerr } = await supabase
      .from("finance_approvals").select("*").eq("id", approval_id).single();
    if (aerr || !appr) {
      return new Response(JSON.stringify({ error: "Approval not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (appr.status !== "pending") {
      return new Response(JSON.stringify({ error: "Approval already processed" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    let upd: Record<string,unknown>;
    try {upd=approvalDecision(appr,user.id,action,comment,now);} catch(e) {return new Response(JSON.stringify({error:e instanceof Error?e.message:'Freigabe nicht zulässig'}),{status:409,headers:{...corsHeaders,'Content-Type':'application/json'}});}
    const {data:target,error:targetError} = appr.entity_type === 'incoming_invoice'
      ? await supabase.from('finance_incoming_invoices').select('id,tenant_id').eq('id',appr.entity_id).maybeSingle()
      : {data:null,error:null};
    if (appr.entity_type === 'incoming_invoice' && (targetError || !target || target.tenant_id !== appr.tenant_id)) return new Response(JSON.stringify({error:'Zielrechnung nicht zugänglich oder falsche Firma'}),{status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});
    let update = supabase.from("finance_approvals").update(upd).eq("id",approval_id).eq('status','pending');
    update = appr.approved_by ? update.eq('approved_by',appr.approved_by) : update.is('approved_by',null);
    const {data:changed,error:changeError} = await update.select('id').maybeSingle();
    if (changeError || !changed) return new Response(JSON.stringify({error:'Freigabe abgewiesen oder inzwischen verändert'}),{status:409,headers:{...corsHeaders,'Content-Type':'application/json'}});

    // Wirkung auf Zielentität
    if (upd.status === "approved" && appr.entity_type === "incoming_invoice") {
      await supabase.from("finance_incoming_invoices")
        .update({ status: "freigegeben", approved_by: user.id, approved_at: now })
        .eq("id", appr.entity_id);
    }
    if (upd.status === "rejected" && appr.entity_type === "incoming_invoice") {
      await supabase.from("finance_incoming_invoices")
        .update({ status: "abgelehnt" })
        .eq("id", appr.entity_id);
    }

    // Audit
    await supabase.rpc("log_audit_event", {
      _action: action.toUpperCase(),
      _module: "finance_approvals",
      _record_id: approval_id,
      _details: { entity_type: appr.entity_type, entity_id: appr.entity_id, comment },
    });

    return new Response(JSON.stringify({ ok: true, status: upd.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
