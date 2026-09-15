// GoBD Phase 15 / 15B – echter Wiederherstellungstest, ressourcenschonend.
//
// NOTFALL-UMBAU: Es wird niemals der komplette Bestand in einem Lauf verarbeitet.
//  * max. BATCH_ROWS (250) Datensaetze je Schreibpaket
//  * Cursor-Verarbeitung ueber die Reihenfolge der Sicherungsdatei (kein OFFSET)
//  * persistenter Checkpoint nach JEDEM Paket  -> Fortsetzung exakt an der Stelle
//  * kurze Pause zwischen den Paketen (BATCH_PAUSE_MS)
//  * exponentielles Backoff bei Timeout/Ressourcenfehlern, keine Endlosschleife
//  * Health-Gate: vor Start/Fortsetzung wird die Datenbank leicht angetippt
//  * Steuerung: start | continue | pause | resume | status | abort
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
  "finance_audit_trail",
  "invoice_audit_log",
  "invoice_corrections",
  "invoice_number_audit",
  "invoice_number_ranges",
  "finance_periods",
  "bank_imports",
  "bank_transactions",
  "bank_transaction_allocations",
  "gobd_legal_holds",
  "gobd_legal_hold_items",
  "gobd_procedure_docs",
  "gobd_export_log",
  "gobd_retention_audit",
  "gobd_sync_conflicts",
  "gobd_change_log",
];

const BUDGET_MS = 40_000;      // Zeitbudget je Aufruf
const BATCH_ROWS = 250;        // max. Datensaetze je Schreibpaket
const BATCH_PAUSE_MS = 350;    // Pause zwischen den Paketen
const MAX_RETRIES = 6;         // danach: Lauf pausiert mit Fehlerhinweis
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Plan = { table: string; path: string; rows: number };
type State = {
  phase: "load" | "verify";
  plan: Plan[];
  idx: number;          // aktuelle Sicherungsdatei
  roff?: number;        // bereits geladene Datensaetze dieser Datei (Checkpoint)
  vidx?: number;        // aktuelle Tabelle im Vergleich
  counts: Record<string, number>;
  manifest_path: string;
  control?: "running" | "paused";
  rows_done?: number;   // gesamt verarbeitete Datensaetze
  rows_total?: number;  // gesamt erwartete Datensaetze
  batches?: number;     // Anzahl abgeschlossener Pakete
  retries?: number;
  next_retry_at?: string | null;
  last_error?: string | null;
  last_checkpoint_at?: string | null;
};

function isResourceError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("timeout") || m.includes("timed out") || m.includes("connection")
    || m.includes("resource") || m.includes("too many") || m.includes("57014")
    || m.includes("503") || m.includes("504") || m.includes("522");
}

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
  const runId0 = body.run_id ? String(body.run_id) : null;

  const saveState = async (rid: string, st: State) => {
    st.last_checkpoint_at = new Date().toISOString();
    await sb.from("gobd_restore_runs").update({ summary: { state: st } }).eq("id", rid);
  };
  const loadRun = async (rid: string) => {
    const { data: run, error } = await sb.from("gobd_restore_runs").select("*").eq("id", rid).maybeSingle();
    if (error || !run) throw new Error("Restore-Lauf nicht gefunden");
    return run as { id: string; status: string; summary: { state: State } | null };
  };
  const progressOf = (st: State) => ({
    phase: st.phase,
    control: st.control ?? "running",
    file: `${st.idx}/${st.plan.length}`,
    rows_done: st.rows_done ?? 0,
    rows_total: st.rows_total ?? 0,
    batches: st.batches ?? 0,
    verify: st.phase === "verify" ? `${st.vidx ?? 0}/${SCOPE.length}` : null,
    last_checkpoint_at: st.last_checkpoint_at ?? null,
    retries: st.retries ?? 0,
    next_retry_at: st.next_retry_at ?? null,
    last_error: st.last_error ?? null,
  });

  // Leichter Health-Check: eine winzige Abfrage, kein Vollscan.
  const healthy = async () => {
    try {
      const { error } = await sb.from("gobd_restore_runs").select("id").limit(1);
      return !error;
    } catch { return false; }
  };

  try {
    // --- Steuerbefehle ------------------------------------------------------
    if (action === "status" && runId0) {
      const run = await loadRun(runId0);
      const st = run.summary?.state;
      return json({ run_id: runId0, status: run.status, progress: st ? progressOf(st) : null });
    }
    if (action === "pause" && runId0) {
      const run = await loadRun(runId0);
      const st = run.summary!.state;
      st.control = "paused";
      await saveState(runId0, st);
      return json({ run_id: runId0, paused: true, progress: progressOf(st) });
    }
    if (action === "abort" && runId0) {
      const { data: res, error } = await sb.rpc("gobd_restore_finish", { _run_id: runId0, _cleanup: true });
      if (error) throw new Error(`Abbruch: ${error.message}`);
      return json({ done: true, aborted: true, run_id: runId0, result: res });
    }

    if (!(await healthy())) {
      return json({
        done: false, paused: true, reason: "db_unhealthy",
        message: "Datenbank derzeit nicht ausreichend erreichbar – Verarbeitung nicht gestartet.",
      }, 202);
    }

    let runId = runId0;
    let state: State;

    if (action === "start" || !runId) {
      let q = sb.from("backups_metadata").select("*").eq("backup_status", "success")
        .like("storage_location", "supabase_storage%").order("completed_at", { ascending: false }).limit(1);
      if (body.backup_id) q = sb.from("backups_metadata").select("*").eq("id", String(body.backup_id)).limit(1);
      const { data: backups, error: bErr } = await q;
      if (bErr) throw new Error(`Backup-Auswahl: ${bErr.message}`);
      const backup = backups?.[0];
      if (!backup) return json({ error: "Keine geeignete Sicherung gefunden" }, 404);

      const { data: mBlob, error: mErr } = await sb.storage.from("backups").download(backup.storage_path);
      if (mErr || !mBlob) throw new Error(`Manifest ${backup.storage_path}: ${mErr?.message ?? "nicht lesbar"}`);
      const manifest = JSON.parse(await mBlob.text());
      const counts: Record<string, number> = manifest?.counts ?? {};
      const files: Plan[] = (manifest?.files ?? []).filter((f: Plan) => SCOPE.includes(f.table));

      const { data: rid, error: rErr } = await sb.rpc("gobd_restore_begin", {
        _backup_id: backup.id,
        _backup_path: backup.storage_path,
        _backup_created_at: backup.completed_at ?? backup.started_at,
        _backup_location: backup.storage_location,
      });
      if (rErr) throw new Error(`Restore-Start: ${rErr.message}`);
      runId = String(rid);
      state = {
        phase: "load", plan: files, idx: 0, roff: 0, counts, manifest_path: backup.storage_path,
        control: "running", rows_done: 0, batches: 0, retries: 0,
        rows_total: files.reduce((s, f) => s + (f.rows ?? 0), 0),
      };
      await saveState(runId, state);
    } else {
      const run = await loadRun(runId);
      state = run.summary!.state;
      if (action === "resume") { state.control = "running"; state.retries = 0; state.next_retry_at = null; }
    }

    if ((state.control ?? "running") === "paused") {
      return json({ done: false, paused: true, run_id: runId, progress: progressOf(state) }, 202);
    }
    if (state.next_retry_at && Date.now() < Date.parse(state.next_retry_at)) {
      return json({ done: false, waiting: true, run_id: runId, progress: progressOf(state) }, 202);
    }

    // --- Ladephase: Pakete zu max. 250 Datensaetzen mit Checkpoint -----------
    while (state.phase === "load" && state.idx < state.plan.length) {
      if (Date.now() - started > BUDGET_MS) {
        await saveState(runId!, state);
        return json({ done: false, run_id: runId, progress: progressOf(state) }, 202);
      }
      const part = state.plan[state.idx];
      const { data: blob, error: dErr } = await sb.storage.from("backups").download(part.path);
      if (dErr || !blob) throw new Error(`Teil ${part.path}: ${dErr?.message ?? "nicht lesbar"}`);

      const skip = state.roff ?? 0;
      let seen = 0;
      let buf = "";
      let batch: unknown[] = [];
      let budgetHit = false;

      const flush = async () => {
        if (batch.length === 0) return;
        const rows = batch;
        batch = [];
        // idempotent: gobd_restore_load schreibt je Datensatz-Identitaet
        const { error: lErr } = await sb.rpc("gobd_restore_load", {
          _run_id: runId, _table: part.table, _rows: rows,
        });
        if (lErr) throw new Error(`Laden ${part.table} (${part.path}): ${lErr.message}`);
        state.roff = (state.roff ?? 0) + rows.length;
        state.rows_done = (state.rows_done ?? 0) + rows.length;
        state.batches = (state.batches ?? 0) + 1;
        await saveState(runId!, state);     // Checkpoint nach JEDEM Paket
        await sleep(BATCH_PAUSE_MS);        // Lastbremse
      };
      const handleLine = async (line: string) => {
        if (budgetHit) return;
        if (line.trim().length === 0) return;
        seen += 1;
        if (seen <= skip) return;           // bereits geladene Datensaetze ueberspringen
        batch.push(JSON.parse(line));
        if (batch.length >= BATCH_ROWS) {
          await flush();
          if (Date.now() - started > BUDGET_MS) budgetHit = true;
        }
      };

      const reader = blob.stream().pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          await handleLine(line);
        }
        if (budgetHit) break;
      }
      if (!budgetHit) {
        await handleLine(buf);
        await flush();
      }
      try { await reader.cancel(); } catch { /* ignore */ }

      if (budgetHit) {
        await saveState(runId!, state);
        return json({ done: false, run_id: runId, progress: progressOf(state) }, 202);
      }
      state.idx += 1;
      state.roff = 0;
      await saveState(runId!, state);
    }

    // --- Pruefphase: tabellenweise, nie als eine Vollabfrage -----------------
    state.phase = "verify";
    state.vidx = state.vidx ?? 0;
    await saveState(runId!, state);

    while ((state.vidx ?? 0) < SCOPE.length) {
      if (Date.now() - started > BUDGET_MS) {
        await saveState(runId!, state);
        return json({ done: false, run_id: runId, progress: progressOf(state) }, 202);
      }
      const t = SCOPE[state.vidx!];
      const { error: cErr } = await sb.rpc("gobd_restore_compare_one", {
        _run_id: runId, _counts: state.counts, _table: t,
      });
      if (cErr) throw new Error(`Vergleich ${t}: ${cErr.message}`);

      // gleiche Anzahl ist kein Inhaltsnachweis → Hash je Datensatz, tabellenweise
      const { error: hashErr } = await sb.rpc("gobd_restore_content_check", {
        _run_id: runId, _scope: [t],
      });
      if (hashErr) throw new Error(`Inhaltsvergleich ${t}: ${hashErr.message}`);
      state.vidx! += 1;
      await saveState(runId!, state);
      await sleep(BATCH_PAUSE_MS);
    }

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
    const msg = e instanceof Error ? e.message : String(e);
    // Lastbremse: Ressourcenfehler pausieren den Lauf mit Backoff statt harter Wiederholung
    if (runId0 && isResourceError(msg)) {
      try {
        const run = await loadRun(runId0);
        const st = run.summary?.state;
        if (st) {
          st.retries = (st.retries ?? 0) + 1;
          st.last_error = msg;
          if (st.retries > MAX_RETRIES) {
            st.control = "paused";
            st.next_retry_at = null;
          } else {
            st.next_retry_at = new Date(Date.now() + BACKOFF_MS[Math.min(st.retries - 1, BACKOFF_MS.length - 1)]).toISOString();
          }
          await saveState(runId0, st);
          return json({
            done: false, run_id: runId0, backoff: true,
            paused: st.control === "paused", error: msg, progress: progressOf(st),
          }, 202);
        }
      } catch { /* ignore */ }
    }
    return json({ done: false, error: msg }, 500);
  }
});
