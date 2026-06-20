// Fetch a public web page and return its text content (HTML stripped).
// Requires auth (default verify_jwt=true). Only callable from app.
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function htmlToText(html: string): { title: string; text: string } {
  // remove scripts/styles/noscript
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
              .replace(/<style[\s\S]*?<\/style>/gi, " ")
              .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
              .replace(/<!--([\s\S]*?)-->/g, " ");
  const titleMatch = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  // block tags → newline
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // strip remaining tags
  s = s.replace(/<[^>]+>/g, " ");
  // decode common entities
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
       .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  return { title, text: s };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let u: URL;
    try { u = new URL(url); } catch {
      return new Response(JSON.stringify({ error: "invalid URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!["http:", "https:"].includes(u.protocol)) {
      return new Response(JSON.stringify({ error: "only http(s) URLs allowed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const res = await fetch(u.toString(), {
      headers: {
        "User-Agent": "AlixWorkCopilotBot/1.0 (+https://alixwork.de)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Fetch failed: HTTP ${res.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ct = res.headers.get("content-type") || "";
    const raw = await res.text();
    let title = ""; let text = "";
    if (ct.includes("html") || raw.trim().startsWith("<")) {
      const out = htmlToText(raw);
      title = out.title; text = out.text;
    } else {
      text = raw;
    }
    if (text.length > 200_000) text = text.slice(0, 200_000);

    return new Response(JSON.stringify({
      url: u.toString(), title, text, length: text.length, content_type: ct,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
