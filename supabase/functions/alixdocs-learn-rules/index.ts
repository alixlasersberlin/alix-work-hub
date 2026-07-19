// AlixDocs Learning Engine – Etappe 4
// Analysiert alixdocs_match_feedback und erzeugt/aktualisiert alixdocs_matching_rules.
// Strategie:
//  1) Für jedes Feedback: Filename-Tokens (>=4 Zeichen, alphanumerisch) extrahieren
//  2) Kombination (token, chosen_entity_type, chosen_entity_id) zählen
//  3) Wenn Kombination >=2x akzeptiert wurde → Regel anlegen (weight_bonus=25)
//     Wenn >=5x → weight_bonus=50
//  4) Bestehende Regeln: hit_count += Anzahl neuer Bestätigungen
//  5) Regeln, die häufig in rejected_candidates auftauchen → deaktivieren
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STOP = new Set([
  "scan","scan1","scan2","dokument","document","copy","kopie","final","draft",
  "pdf","jpg","jpeg","png","heic","tiff","img","image","foto","photo",
  "neu","new","alt","old","version","seite","page","export","download",
  "unbenannt","untitled","screenshot","print","druck","file","datei",
]);

function tokenize(name: string): string[] {
  if (!name) return [];
  const base = name.toLowerCase().replace(/\.[a-z0-9]{2,5}$/i, "");
  const parts = base.split(/[^a-z0-9]+/i).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    if (p.length < 4) continue;
    if (STOP.has(p)) continue;
    if (/^\d+$/.test(p) && p.length < 5) continue;
    out.add(p);
  }
  return [...out];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: Service-Role (Cron/Trigger) ODER Admin/Super Admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let uid: string | null = null;
  if (jwt && jwt !== serviceKey) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    uid = userRes?.user?.id ?? null;
    if (!uid) return json(401, { error: "unauthorized" });
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      userClient.rpc("has_role", { check_role: "Admin" }),
      userClient.rpc("has_role", { check_role: "Super Admin" }),
    ]);
    if (!isAdmin && !isSuper) return json(403, { error: "forbidden" });
  }


  const body = await req.json().catch(() => ({}));
  const sinceDays = Number(body?.since_days ?? 90);
  const dryRun = Boolean(body?.dry_run ?? false);

  const sinceIso = new Date(Date.now() - sinceDays * 86400_000).toISOString();

  // Feedback laden
  const { data: fb, error: fbErr } = await supa
    .from("alixdocs_match_feedback")
    .select("id, document_id, chosen_entity_type, chosen_entity_id, rejected_candidates, created_at")
    .gte("created_at", sinceIso)
    .not("chosen_entity_id", "is", null);
  if (fbErr) return json(500, { error: fbErr.message });

  const docIds = [...new Set((fb ?? []).map((f) => f.document_id).filter(Boolean))];
  const docsById = new Map<string, any>();
  if (docIds.length) {
    const { data: docs } = await supa
      .from("alixdocs_documents")
      .select("id, original_filename, title")
      .in("id", docIds);
    (docs ?? []).forEach((d) => docsById.set(d.id, d));
  }

  // Zählung: token|type|id → { accept, reject }
  type Key = string;
  const stats = new Map<Key, { token: string; type: string; id: string; accept: number; reject: number }>();
  const mkKey = (t: string, ty: string, id: string) => `${t}|${ty}|${id}`;

  for (const f of fb ?? []) {
    const doc = docsById.get(f.document_id);
    const name = (doc?.original_filename || doc?.title || "") as string;
    const tokens = tokenize(name);
    for (const tok of tokens) {
      const k = mkKey(tok, f.chosen_entity_type, f.chosen_entity_id);
      const cur = stats.get(k) ?? { token: tok, type: f.chosen_entity_type, id: f.chosen_entity_id, accept: 0, reject: 0 };
      cur.accept++;
      stats.set(k, cur);
      // rejected → negative Signale
      const rej = Array.isArray(f.rejected_candidates) ? f.rejected_candidates : [];
      for (const r of rej) {
        const rid = r?.entity_id ?? r?.id;
        const rty = r?.entity_type ?? r?.type ?? f.chosen_entity_type;
        if (!rid) continue;
        const rk = mkKey(tok, rty, rid);
        const rcur = stats.get(rk) ?? { token: tok, type: rty, id: rid, accept: 0, reject: 0 };
        rcur.reject++;
        stats.set(rk, rcur);
      }
    }
  }

  // Bestehende Regeln laden
  const { data: existingRules } = await supa
    .from("alixdocs_matching_rules")
    .select("id, pattern, target_type, target_id, hit_count, is_active, weight_bonus");
  const ruleIdx = new Map<Key, any>();
  (existingRules ?? []).forEach((r) => {
    if (r.target_id) ruleIdx.set(mkKey(String(r.pattern).toLowerCase(), r.target_type, r.target_id), r);
  });

  const toInsert: any[] = [];
  const toUpdate: any[] = [];
  const toDeactivate: string[] = [];

  for (const s of stats.values()) {
    if (s.accept < 2) continue;
    // negatives Signal deutlich überwiegend → skip / deaktivieren
    if (s.reject > s.accept * 2) {
      const existing = ruleIdx.get(mkKey(s.token, s.type, s.id));
      if (existing?.is_active) toDeactivate.push(existing.id);
      continue;
    }
    const bonus = s.accept >= 5 ? 50 : 25;
    const existing = ruleIdx.get(mkKey(s.token, s.type, s.id));
    if (existing) {
      toUpdate.push({
        id: existing.id,
        hit_count: (existing.hit_count ?? 0) + s.accept,
        weight_bonus: Math.max(existing.weight_bonus ?? 0, bonus),
        is_active: true,
      });
    } else {
      toInsert.push({
        pattern: s.token,
        field: "filename",
        target_type: s.type,
        target_id: s.id,
        weight_bonus: bonus,
        hit_count: s.accept,
        is_active: true,
        created_by: uid,
      });
    }
  }

  const summary = {
    feedback_count: fb?.length ?? 0,
    combinations: stats.size,
    new_rules: toInsert.length,
    updated_rules: toUpdate.length,
    deactivated_rules: toDeactivate.length,
    dry_run: dryRun,
  };

  if (dryRun) return json(200, { ok: true, summary, preview: toInsert.slice(0, 20) });

  if (toInsert.length) {
    const { error } = await supa.from("alixdocs_matching_rules").insert(toInsert);
    if (error) return json(500, { error: error.message, phase: "insert" });
  }
  for (const u of toUpdate) {
    await supa.from("alixdocs_matching_rules").update({
      hit_count: u.hit_count,
      weight_bonus: u.weight_bonus,
      is_active: u.is_active,
      updated_at: new Date().toISOString(),
    }).eq("id", u.id);
  }
  if (toDeactivate.length) {
    await supa.from("alixdocs_matching_rules")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", toDeactivate);
  }

  return json(200, { ok: true, summary });
});
