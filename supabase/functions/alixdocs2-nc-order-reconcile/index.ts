// ALIXDocs AI 2.0 — Nextcloud Order-Reconcile
// Scannt einen NC-Ordner, extrahiert Auftrags-Nummern aus Dateinamen,
// prüft ob der Auftrag in AlixWork (orders) existiert.
// - vorhanden → als "existing" markieren (überspringen)
// - fehlend → über Zoho suchen + sync-single-order importieren
// - kein Muster → "no_number"
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const b64 = (v: string) => {
  const bytes = new TextEncoder().encode(v);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const authFor = (u: string, p: string) => `Basic ${b64(`${u}:${p}`)}`;
const passwordCandidates = (p: string) => {
  const v = [p, p.trim(), p.replace(/\s+/g, ""), p.trim().replace(/\s+/g, "")];
  return [...new Set(v)].filter(Boolean);
};
const encodePath = (p: string) => p.split("/").filter(Boolean).map(encodeURIComponent).join("/");

function parsePropfind(xml: string): { href: string; is_dir: boolean }[] {
  const out: { href: string; is_dir: boolean }[] = [];
  const rx = /<d:response[^>]*>([\s\S]*?)<\/d:response>/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(xml))) {
    const b = m[1];
    const href = (/<d:href[^>]*>([\s\S]*?)<\/d:href>/i.exec(b)?.[1] ?? "").trim();
    if (!href) continue;
    const isDir = /<d:resourcetype>[\s\S]*<d:collection[\s\S]*<\/d:resourcetype>/i.test(b);
    out.push({ href: decodeURIComponent(href), is_dir: isDir });
  }
  return out.filter((e) => !e.is_dir);
}

// Regex für Alix-Auftragsnummern: 2026-04226 oder 2026-04226-AT
const ORDER_RX = /\b(20\d{2}-\d{3,6})(-AT)?\b/gi;

function extractOrderNumbers(filename: string): string[] {
  const set = new Set<string>();
  const base = filename.replace(/\.[^./]+$/, "");
  let m: RegExpExecArray | null;
  const rx = new RegExp(ORDER_RX.source, "gi");
  while ((m = rx.exec(base))) {
    const num = `${m[1]}${m[2] ? "-AT" : ""}`.toUpperCase();
    set.add(num);
  }
  return [...set];
}

async function zohoSearch(authHeader: string, query: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/zoho-orders-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: SERVICE_KEY },
    body: JSON.stringify({ query, mode: "number", entities: ["salesorder"] }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  const hits: any[] = [];
  for (const r of (j?.results ?? [])) {
    for (const row of (r?.results ?? [])) {
      hits.push({ ...row, source_system: r.source });
    }
  }
  return hits;
}

async function importOne(source: string, external_order_id: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-single-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    body: JSON.stringify({ source_system: source, external_order_id }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const uc = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: isAdmin } = await uc.rpc("has_role", { check_role: "Admin" });
  const { data: isSuper } = await uc.rpc("has_role", { check_role: "Super Admin" });
  if (!isAdmin && !isSuper) return json(403, { error: "forbidden" });

  const body = await req.json().catch(() => ({}));
  const folder_id = String(body?.folder_id ?? "");
  const doImport = body?.import !== false; // default true
  if (!folder_id) return json(400, { error: "folder_id required" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: folder } = await admin.from("alixdocs2_nc_watched_folders")
    .select("id, server_id, path, recursive").eq("id", folder_id).maybeSingle();
  if (!folder) return json(404, { error: "folder_not_found" });
  const { data: server } = await admin.from("alixdocs2_nc_servers")
    .select("id, base_url, username, app_password_secret_name").eq("id", folder.server_id).maybeSingle();
  if (!server) return json(404, { error: "server_not_found" });
  const password = Deno.env.get(server.app_password_secret_name);
  if (!password) return json(400, { error: "secret_missing" });

  const cleanPath = folder.path.replace(/^\/+/, "").replace(/\/+$/, "");
  const davBase = `/remote.php/dav/files/${encodeURIComponent(server.username)}/${cleanPath ? `${encodePath(cleanPath)}/` : ""}`;
  const davUrl = `${server.base_url.replace(/\/$/, "")}${davBase}`;

  let resp: Response | null = null;
  for (const cand of passwordCandidates(password)) {
    resp = await fetch(davUrl, {
      method: "PROPFIND",
      headers: {
        Authorization: authFor(server.username, cand),
        Depth: folder.recursive ? "infinity" : "1",
        "Content-Type": "application/xml",
        "User-Agent": "AlixWork-AlixDocs/2.0",
      },
    });
    if (resp.ok || resp.status === 207 || resp.status !== 401) break;
  }
  if (!resp || (!resp.ok && resp.status !== 207)) {
    const status = resp?.status ?? 0;
    const preview = resp ? (await resp.text()).slice(0, 300) : "";
    return json(200, {
      ok: false,
      error: `PROPFIND ${status || "unreachable"}`,
      hint: status === 404
        ? `Ordner nicht gefunden in Nextcloud. Bitte den Pfad des überwachten Ordners prüfen (aktuell: "${folder.path || "/"}"). Er muss relativ zum User-Root von "${server.username}" existieren.`
        : status === 401
          ? "Nextcloud lehnt die Zugangsdaten ab. Bitte App-Passwort erneuern."
          : "Nextcloud antwortet nicht wie erwartet.",
      dav_url: davUrl,
      response_preview: preview,
    });
  }
  const xml = await resp.text();
  const entries = parsePropfind(xml);

  // Extract numbers + map back to files
  const numberToFiles = new Map<string, string[]>();
  const filesNoNumber: string[] = [];
  for (const e of entries) {
    const name = e.href.split("/").pop() ?? e.href;
    const nums = extractOrderNumbers(name);
    if (nums.length === 0) filesNoNumber.push(name);
    for (const n of nums) {
      const arr = numberToFiles.get(n) ?? [];
      arr.push(name);
      numberToFiles.set(n, arr);
    }
  }
  const numbers = [...numberToFiles.keys()];

  // Check local orders (both raw and stripped -AT — AT-suffix is UI-only for zoho_eu_1? For zoho_eu_2 items DB, but orders order_number is the pure zoho salesorder_number)
  const stripAt = (n: string) => n.endsWith("-AT") ? n.slice(0, -3) : n;
  const lookup = numbers.map(stripAt);
  const existingSet = new Set<string>();
  if (lookup.length) {
    for (let i = 0; i < lookup.length; i += 200) {
      const chunk = lookup.slice(i, i + 200);
      const { data } = await admin.from("orders").select("order_number").in("order_number", chunk);
      (data as any[] | null)?.forEach((r) => existingSet.add(String(r.order_number).toUpperCase()));
    }
  }

  const existing: { number: string; files: string[] }[] = [];
  const missing: string[] = [];
  for (const n of numbers) {
    if (existingSet.has(stripAt(n).toUpperCase())) {
      existing.push({ number: n, files: numberToFiles.get(n) ?? [] });
    } else {
      missing.push(n);
    }
  }

  const imported: { number: string; source: string; external_id: string; files: string[] }[] = [];
  const notFound: { number: string; files: string[] }[] = [];
  const failed: { number: string; message: string; files: string[] }[] = [];

  if (doImport) {
    for (const num of missing) {
      const bareNum = stripAt(num);
      const hits = await zohoSearch(authHeader, bareNum);
      const exact = hits.find((h) => String(h.salesorder_number ?? "").toUpperCase() === bareNum.toUpperCase())
        || hits[0];
      if (!exact) {
        notFound.push({ number: num, files: numberToFiles.get(num) ?? [] });
        continue;
      }
      const r = await importOne(exact.source_system, exact.salesorder_id);
      if (r.ok) {
        imported.push({ number: num, source: exact.source_system, external_id: exact.salesorder_id, files: numberToFiles.get(num) ?? [] });
        await admin.from("orders").update({ imported_via_reconcile_at: new Date().toISOString() })
          .eq("source_system", exact.source_system).eq("external_order_id", exact.salesorder_id);
      } else {
        const msg = (r.body as any)?.message || (r.body as any)?.error || `HTTP ${r.status}`;
        failed.push({ number: num, message: msg, files: numberToFiles.get(num) ?? [] });
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  } else {
    for (const num of missing) notFound.push({ number: num, files: numberToFiles.get(num) ?? [] });
  }

  return json(200, {
    ok: true,
    folder_id,
    files_scanned: entries.length,
    numbers_found: numbers.length,
    existing_count: existing.length,
    imported_count: imported.length,
    not_found_count: notFound.length,
    failed_count: failed.length,
    files_without_number: filesNoNumber.length,
    existing,
    imported,
    not_found: notFound,
    failed,
    files_no_number_sample: filesNoNumber.slice(0, 50),
  });
});
