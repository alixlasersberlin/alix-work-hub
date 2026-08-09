import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key);

  const email = "m.sobitsch@alix-operation.de";
  const full_name = "Dr. Michael Sobitsch";

  let userId: string | null = null;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    ban_duration: "876000h",
    user_metadata: { full_name },
  });
  if (created?.user) {
    userId = created.user.id;
  } else {
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const m = list?.users.find((u) => (u.email || "").toLowerCase() === email);
      if (m) userId = m.id;
      if (!list || list.users.length < 200) break;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: cErr?.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  await admin.from("user_profiles").upsert({
    id: userId,
    full_name,
    email,
    account_status: "inactive",
    is_active: false,
  });

  const { data: emp } = await admin
    .from("commission_employees")
    .upsert({ employee_id: userId, commission_active: true }, { onConflict: "employee_id" })
    .select("id")
    .single();

  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .ilike("salesperson_name", "%sobitsch%")
    .limit(5000);

  const rows = (orders || []).map((o: { id: string }) => ({
    order_id: o.id,
    employee_id: userId,
    employee_role: "verkaeufer",
    share_percent: 100,
    source: "manual",
  }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin
      .from("commission_assignments")
      .upsert(rows.slice(i, i + 200), { onConflict: "order_id,employee_id,employee_role" });
    if (!error) inserted += rows.slice(i, i + 200).length;
  }

  return new Response(JSON.stringify({ userId, employee: emp?.id, orders: rows.length, inserted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
