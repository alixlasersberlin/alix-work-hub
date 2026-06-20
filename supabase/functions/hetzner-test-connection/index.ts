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
    return new Response(JSON.stringify({ ok: false, message: "Hetzner S3 nicht konfiguriert" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  try {
    const aws = new AwsClient({ accessKeyId: ak, secretAccessKey: sk, service: "s3", region });
    const base = (/^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`).replace(/\/+$/, "");
    const r = await aws.fetch(`${base}/${bucket}?list-type=2&max-keys=1`);
    const ok = r.ok;
    const text = ok ? "" : (await r.text()).slice(0, 300);
    return new Response(JSON.stringify({ ok, endpoint: base, bucket, message: ok ? "Verbindung OK" : text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
