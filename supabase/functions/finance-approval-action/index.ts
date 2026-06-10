// Phase 11: Approval Action (approve / reject / dual-approve)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { approval_id, action, comment } = body ?? {};
    if (!approval_id || !["approve", "reject", "cancel"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    let upd: any = { comment };

    if (action === "cancel") {
      upd.status = "cancelled";
    } else if (action === "reject") {
      upd.status = "rejected";
      upd.rejection_reason = comment ?? "Ohne Angabe";
      upd.approved_by = user.id;
      upd.approved_at = now;
    } else {
      // approve
      if (appr.requires_dual_approval && appr.approved_by && appr.approved_by !== user.id) {
        upd.second_approver_id = user.id;
        upd.second_approved_at = now;
        upd.status = "approved";
      } else if (appr.requires_dual_approval && !appr.approved_by) {
        upd.approved_by = user.id;
        upd.approved_at = now;
        upd.status = "pending";
      } else if (appr.requires_dual_approval && appr.approved_by === user.id) {
        return new Response(JSON.stringify({ error: "Zweiter Genehmiger erforderlich" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        upd.approved_by = user.id;
        upd.approved_at = now;
        upd.status = "approved";
      }
    }

    await supabase.from("finance_approvals").update(upd).eq("id", approval_id);

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
