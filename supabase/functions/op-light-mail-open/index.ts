// Lesesignal fuer FIBU-LIGHT-Mahnmails: liefert ein 1x1-Pixel und protokolliert die Oeffnung.
const GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pixelResponse = new Response(GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Access-Control-Allow-Origin': '*',
    },
  });

  try {
    const token = new URL(req.url).searchParams.get('t') || '';
    if (!UUID_RE.test(token)) return pixelResponse;

    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return pixelResponse;

    await fetch(`${url}/rest/v1/rpc/op_light_mark_email_opened`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_token: token }),
    });
  } catch (_e) {
    // Lesesignal darf niemals die Bildauslieferung stoeren
  }

  return pixelResponse;
});
