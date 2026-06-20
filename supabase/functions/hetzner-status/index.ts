import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const endpoint = Deno.env.get("HETZNER_S3_ENDPOINT");
  const region = Deno.env.get("HETZNER_S3_REGION") ?? "eu-central";
  const bucket = Deno.env.get("HETZNER_S3_BUCKET");
  const ak = Deno.env.get("HETZNER_S3_ACCESS_KEY");
  const sk = Deno.env.get("HETZNER_S3_SECRET_KEY");
  if (!endpoint || !bucket || !ak || !sk) {
    return new Response(JSON.stringify({ ok: false, configured: false, message: "Hetzner S3 nicht konfiguriert" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  try {
    const aws = new AwsClient({ accessKeyId: ak, secretAccessKey: sk, service: "s3", region });
    const base = (/^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`).replace(/\/+$/, "");
    const r = await aws.fetch(`${base}/${bucket}?list-type=2&max-keys=1000`);
    const text = await r.text();
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, endpoint: base, bucket, message: text.slice(0, 300) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // crude size sum
    const sizes = [...text.matchAll(/<Size>(\d+)<\/Size>/g)].map((m) => parseInt(m[1]));
    const used = sizes.reduce((a, b) => a + b, 0);
    const last = [...text.matchAll(/<LastModified>([^<]+)<\/LastModified>/g)].map((m) => m[1]).sort().pop() || null;
    return new Response(JSON.stringify({ ok: true, endpoint: base, bucket, used_bytes: used, last_sync: last }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
