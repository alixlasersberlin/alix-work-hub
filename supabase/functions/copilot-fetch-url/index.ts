// Fetch a public web page and return its text content (HTML stripped).
// Härtungen:
//  - Auth required (JWT)
//  - Nur http/https
//  - SSRF-Schutz: Host-Resolve + Block für localhost / private / link-local /
//    loopback / cloud-metadata IPs (auch nach Redirects)
//  - Max 5 Redirects, manueller Follow mit Re-Validierung
//  - Größen-Limit 3 MB, Timeout 12s
//  - Einfacher per-User Rate-Limit (in-memory, 20 req / 5 min)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 12_000;

// ----- Rate Limit (per Edge-Instanz, best effort) -----
const RL_WINDOW_MS = 5 * 60 * 1000;
const RL_MAX = 20;
const rl = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (rl.get(userId) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) { rl.set(userId, arr); return true; }
  arr.push(now); rl.set(userId, arr); return false;
}

// ----- SSRF helpers -----
function ipToBytes(ip: string): number[] | null {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const p = ip.split(".").map(Number);
    if (p.some((n) => n < 0 || n > 255 || Number.isNaN(n))) return null;
    return p;
  }
  return null;
}
function isPrivateIPv4(ip: string): boolean {
  const b = ipToBytes(ip);
  if (!b) return false;
  // 10.0.0.0/8
  if (b[0] === 10) return true;
  // 172.16.0.0/12
  if (b[0] === 172 && b[1] >= 16 && b[1] <= 31) return true;
  // 192.168.0.0/16
  if (b[0] === 192 && b[1] === 168) return true;
  // 127.0.0.0/8 loopback
  if (b[0] === 127) return true;
  // 0.0.0.0/8
  if (b[0] === 0) return true;
  // 169.254.0.0/16 link-local + cloud-metadata
  if (b[0] === 169 && b[1] === 254) return true;
  // 100.64.0.0/10 CGNAT
  if (b[0] === 100 && b[1] >= 64 && b[1] <= 127) return true;
  // 192.0.0.0/24, 198.18.0.0/15, 203.0.113.0/24, 224+/multicast, 240+/reserved
  if (b[0] === 192 && b[1] === 0 && b[2] === 0) return true;
  if (b[0] === 198 && (b[1] === 18 || b[1] === 19)) return true;
  if (b[0] >= 224) return true;
  return false;
}
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "metadata.google.internal") return true;
  if (h === "metadata.goog") return true;
  // IPv6 loopback / link-local / unique-local
  if (h === "::1" || h === "[::1]") return true;
  if (h.startsWith("[fe80") || h.startsWith("[fc") || h.startsWith("[fd")) return true;
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}
async function assertSafeUrl(u: URL): Promise<void> {
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("only http(s) URLs allowed");
  const host = u.hostname;
  if (!host) throw new Error("invalid host");
  if (isBlockedHost(host)) throw new Error("host not allowed");
  // wenn direkt IPv4: prüfen
  if (ipToBytes(host) && isPrivateIPv4(host)) throw new Error("private IP not allowed");
  // DNS resolve (Deno)
  try {
    // @ts-ignore Deno API
    const records = await (Deno as any).resolveDns(host, "A").catch(() => []);
    for (const ip of records ?? []) {
      if (isPrivateIPv4(ip)) throw new Error("resolved to private IP");
    }
    // @ts-ignore
    const v6 = await (Deno as any).resolveDns(host, "AAAA").catch(() => []);
    for (const ip of v6 ?? []) {
      const low = String(ip).toLowerCase();
      if (low === "::1" || low.startsWith("fe80") || low.startsWith("fc") || low.startsWith("fd")) {
        throw new Error("resolved to private IPv6");
      }
    }
  } catch (e) {
    if (e instanceof Error && /private IP|private IPv6/.test(e.message)) throw e;
    // DNS-Fehler nicht hart blocken (Resolver kann fehlschlagen) — fetch wird sonst eh scheitern
  }
}

async function safeFetchOnce(url: URL, signal: AbortSignal): Promise<Response> {
  await assertSafeUrl(url);
  return await fetch(url.toString(), {
    method: "GET",
    redirect: "manual",
    signal,
    headers: {
      "User-Agent": "AlixWorkCopilotBot/1.0 (+https://alixwork.de)",
      "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8",
    },
  });
}

async function safeFetch(startUrl: URL): Promise<{ res: Response; finalUrl: URL }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let current = startUrl;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const res = await safeFetchOnce(current, ctrl.signal);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { res, finalUrl: current };
        const next = new URL(loc, current);
        current = next;
        continue;
      }
      return { res, finalUrl: current };
    }
    throw new Error("too many redirects");
  } finally {
    clearTimeout(timer);
  }
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let total = 0;
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { try { reader.cancel(); } catch { /**/ } throw new Error("response too large"); }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

function htmlToText(html: string): { title: string; text: string } {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
              .replace(/<style[\s\S]*?<\/style>/gi, " ")
              .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
              .replace(/<!--([\s\S]*?)-->/g, " ");
  const titleMatch = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
       .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  return { title, text: s };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    if (rateLimited(userId)) return json({ error: "Rate limit exceeded. Bitte später erneut versuchen." }, 429);

    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return json({ error: "url is required" }, 400);
    if (url.length > 2048) return json({ error: "url too long" }, 400);

    let u: URL;
    try { u = new URL(url); } catch { return json({ error: "invalid URL" }, 400); }

    const { res, finalUrl } = await safeFetch(u);
    if (!res.ok) return json({ error: `Fetch failed: HTTP ${res.status}` }, 502);

    const ct = res.headers.get("content-type") || "";
    const raw = await readLimited(res);
    let title = ""; let text = "";
    if (ct.includes("html") || raw.trim().startsWith("<")) {
      const out = htmlToText(raw);
      title = out.title; text = out.text;
    } else if (ct.includes("text/") || ct.includes("json") || ct.includes("xml") || ct === "") {
      text = raw;
    } else {
      return json({ error: `unsupported content-type: ${ct}` }, 415);
    }
    if (text.length > 200_000) text = text.slice(0, 200_000);

    return json({ url: finalUrl.toString(), title, text, length: text.length, content_type: ct });
  } catch (e: any) {
    const msg = e?.message || "unknown error";
    const blocked = /not allowed|private IP|too many redirects|too large|only http/.test(msg);
    return json({ error: msg }, blocked ? 400 : 500);
  }
});
