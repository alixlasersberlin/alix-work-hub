// GoBD Phase 15 – echter Wiederherstellungstest.
// Nimmt eine reale Sicherung aus dem Bucket "backups", spielt sie in das
// vollstaendig isolierte Schema `gobd_restore` ein, vergleicht Backup-Zustand
// gegen Restore-Zustand, prueft die Schutzmechanismen nach der Wiederherstellung
// und verwirft die Testumgebung anschliessend wieder.
//
// Es wird NIEMALS in den Produktivbestand zurueckgeschrieben.
// Auth: Super Admin JWT oder CRON_SECRET / SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// GoBD-relevante Objektklassen fuer den Vollstaendigkeitsvergleich
const SCOPE = [
  "zoho_invoices",
  "zoho_recurring_invoices",
  "zoho_unpaid_invoices",
  "finance_transactions",
  "finance_records",
  "finance_bank_statements",
  "finance_bank_lines",
  "number_ranges",
  "customers",
  "audit_logs",
];

const BUDGET_MS = 45_000;

type Plan = { table: string; path: string; rows: number };
type State = {
  phase: "load" | "verify";
  plan: Plan[];
  idx: number;
  counts: Record<string, number>;
  manifest_path: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";

  const testToken = Deno.env.get("GOBD_RESTORE_TEST_TOKEN");
  let ok = (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (testToken && auth === `Bearer ${testToken}`) ||
    auth === `Bearer ${srk}` || apikey === srk;
  if (!ok && auth.startsWith("Bearer ")) {
    try {
      const usb = createClient(url, anon, { global: { headers: { Authorization: auth } } });
      const { data: u } = await usb.auth.getUser();
      if (u?.user) {
        const { data: isSa } = await usb.rpc("has_role", { check_role: "Super Admin" });
        if (isSa) ok = true;
      }
    } catch { /* ignore */ }
  }
  if (!ok) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(url, srk);
  const started = Date.now();
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }
  const action = String(body.action ?? "start");

  try {
    let runId = body.run_id ? String(body.run_id) : null;
    let state: State;

    if (action === "start" || !runId) {
      // 1) Sicherung waehlen (nur Sicherungen im lesbaren Bucket "backups")
      let q = sb.from("backups_metadata").select("*").eq("backup_status", "success")
        .like("storage_location", "supabase_storage%").order("completed_at", { ascending: false }).limit(1);
      if (body.backup_id) q = sb.from("backups_metadata").select("*").eq("id", String(body.backup_id)).limit(1);
      const { data: backups, error: bErr } = await q;
      if (bErr) throw new Error(`Backup-Auswahl: ${bErr.message}`);
      const backup = backups?.[0];
      if (!backup) return json({ error: "Keine geeignete Sicherung gefunden" }, 404);

      // 2) Manifest laden (Integritaetspruefung der Sicherungsstruktur)
      const { data: mBlob, error: mErr } = await sb.storage.from("backups").download(backup.storage_path);
      if (mErr || !mBlob) throw new Error(`Manifest ${backup.storage_path}: ${mErr?.message ?? "nicht lesbar"}`);
      const manifest = JSON.parse(await mBlob.text());
      const counts: Record<string, number> = manifest?.counts ?? {};
      const files: Plan[] = (manifest?.files ?? []).filter((f: Plan) => SCOPE.includes(f.table));

      // 3) Isolierte Zielumgebung erzeugen und Lauf protokollieren
      const { data: rid, error: rErr } = await sb.rpc("gobd_restore_begin", {
        _backup_id: backup.id,
        _backup_path: backup.storage_path,
        _backup_created_at: backup.completed_at ?? backup.started_at,
        _backup_location: backup.storage_location,
      });
      if (rErr) throw new Error(`Restore-Start: ${rErr.message}`);
      runId = String(rid);
      state = { phase: "load", plan: files, idx: 0, counts, manifest_path: backup.storage_path };
      await sb.from("gobd_restore_runs").update({ summary: { state } }).eq("id", runId);
    } else {
      const { data: run, error } = await sb.from("gobd_restore_runs").select("*").eq("id", runId).maybeSingle();
      if (error || !run) throw new Error("Restore-Lauf nicht gefunden");
      state = (run.summary as { state: State }).state;
    }

    // 4) NDJSON-Teile der Sicherung einspielen
    while (state.phase === "load" && state.idx < state.plan.length) {
      if (Date.now() - started > BUDGET_MS) {
        await sb.from("gobd_restore_runs").update({ summary: { state } }).eq("id", runId);
        return json({ done: false, run_id: runId, progress: `${state.idx}/${state.plan.length}` }, 202);
      }
      const part = state.plan[state.idx];
      const { data: blob, error: dErr } = await sb.storage.from("backups").download(part.path);
      if (dErr || !blob) throw new Error(`Teil ${part.path}: ${dErr?.message ?? "nicht lesbar"}`);
      const rows = (await blob.text()).split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));
      const { error: lErr } = await sb.rpc("gobd_restore_load", {
        _run_id: runId, _table: part.table, _rows: rows,
      });
      if (lErr) throw new Error(`Laden ${part.table} (${part.path}): ${lErr.message}`);
      state.idx += 1;
    }

    // 5) Vergleich, Schutztests, Abschluss
    state.phase = "verify";
    await sb.from("gobd_restore_runs").update({ summary: { state } }).eq("id", runId);

    const { error: cErr } = await sb.rpc("gobd_restore_compare", {
      _run_id: runId, _counts: state.counts, _scope: SCOPE,
    });
    if (cErr) throw new Error(`Vergleich: ${cErr.message}`);

    const { error: pErr } = await sb.rpc("gobd_restore_protection_tests", { _run_id: runId });
    if (pErr) throw new Error(`Schutztests: ${pErr.message}`);

    const { error: hErr } = await sb.rpc("gobd_restore_legal_hold_test", { _run_id: runId });
    if (hErr) throw new Error(`Legal-Hold-Test: ${hErr.message}`);

    const { data: fin, error: fErr } = await sb.rpc("gobd_restore_finish", { _run_id: runId, _cleanup: true });
    if (fErr) throw new Error(`Abschluss: ${fErr.message}`);

    const { data: checks } = await sb.from("gobd_restore_checks").select("*").eq("run_id", runId)
      .order("category").order("check_name");

    return json({ done: true, run_id: runId, result: fin, checks });
  } catch (e) {
    return json({ done: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
