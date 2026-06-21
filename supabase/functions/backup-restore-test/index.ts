// Restore-Test: lädt das neueste Backup aus Supabase Storage (bucket "backups"),
// parsed es, vergleicht Tabellenzeilen mit der Live-DB und meldet Drift.
// READ-ONLY – schreibt NICHTS zurück.
// Auth: Super Admin JWT oder CRON_SECRET / SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";

  let ok =
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    auth === `Bearer ${srk}` ||
    apikey === srk;

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
  const start = Date.now();

  try {
    // 1) Neueste JSON-Datei im Bucket "backups" finden (rekursiv: top-level + Unterordner)
    const candidates: { path: string; createdAt: string }[] = [];
    async function walk(prefix: string, depth: number) {
      if (depth > 3) return;
      const { data, error } = await sb.storage.from("backups").list(prefix, {
        limit: 1000,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw new Error(`list ${prefix}: ${error.message}`);
      for (const e of data ?? []) {
        const p = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.id === null) {
          await walk(p, depth + 1);
        } else if (e.name.toLowerCase().endsWith(".json")) {
          candidates.push({ path: p, createdAt: e.created_at ?? "" });
        }
      }
    }
    await walk("", 0);
    if (!candidates.length) return json({ ok: false, error: "Keine Backup-Dateien gefunden" }, 404);

    candidates.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const latest = candidates[0];

    // 2) Datei laden und parsen
    const { data: blob, error: dlErr } = await sb.storage.from("backups").download(latest.path);
    if (dlErr || !blob) throw new Error(`download: ${dlErr?.message ?? "no blob"}`);
    const sizeBytes = blob.size;
    const text = await blob.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch (e) {
      return json({ ok: false, file: latest.path, error: `Backup ist kein gültiges JSON: ${(e as Error).message}` }, 422);
    }

    const tables: Record<string, any[]> = parsed?.tables ?? {};
    const tableNames = Object.keys(tables);
    if (!tableNames.length) {
      return json({ ok: false, file: latest.path, error: "Backup enthält keine Tabellen" }, 422);
    }

    // 3) Pro Tabelle: Anzahl im Backup vs. aktuelle Anzahl in DB vergleichen
    const checks: Array<{ table: string; backup_rows: number; live_rows: number | null; drift_pct: number | null; sample_id_in_db: boolean | null; status: string }> = [];
    for (const t of tableNames) {
      const backupRows = Array.isArray(tables[t]) ? tables[t].length : 0;
      let liveRows: number | null = null;
      let sampleOk: boolean | null = null;
      let status = "ok";

      try {
        const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
        if (error) { status = `live-count-failed: ${error.message}`; }
        else { liveRows = count ?? 0; }
      } catch (e) { status = `live-count-failed: ${(e as Error).message}`; }

      const firstRow = Array.isArray(tables[t]) && tables[t][0];
      if (firstRow && typeof firstRow === "object" && "id" in firstRow && liveRows !== null) {
        try {
          const { data } = await sb.from(t).select("id").eq("id", (firstRow as any).id).maybeSingle();
          sampleOk = !!data;
        } catch { sampleOk = null; }
      }

      let drift: number | null = null;
      if (liveRows !== null && backupRows > 0) {
        drift = Math.round(((liveRows - backupRows) / backupRows) * 10000) / 100;
        if (Math.abs(drift) > 50) status = "drift-high";
      }
      checks.push({ table: t, backup_rows: backupRows, live_rows: liveRows, drift_pct: drift, sample_id_in_db: sampleOk, status });
    }

    const failed = checks.filter(c => c.status !== "ok").length;
    const result = {
      ok: failed === 0,
      file: latest.path,
      created_at: latest.createdAt,
      size_bytes: sizeBytes,
      backup_version: parsed?.version ?? null,
      backup_created_at: parsed?.createdAt ?? null,
      tables_checked: checks.length,
      failed,
      duration_ms: Date.now() - start,
      checks,
    };
    return json(result, failed === 0 ? 200 : 207);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e), duration_ms: Date.now() - start }, 500);
  }
});
