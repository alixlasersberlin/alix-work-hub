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

    const res = await fetch(`${url}/rest/v1/rpc/op_light_mark_email_opened`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_token: token }),
    });
    console.log('mark_email_opened', res.status, (await res.text()).slice(0, 300));
    // Klick-Bestaetigung (falls Bilder im Mailprogramm blockiert sind)
    if (new URL(req.url).searchParams.get('c') === '1') {
      return new Response(
        `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Empfang bestätigt</title></head>
<body style="margin:0;background:#0b0b0d;color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="max-width:440px;padding:32px;text-align:center"><h1 style="font-size:20px;margin:0 0 12px">Vielen Dank</h1>
<p style="font-size:14px;line-height:22px;color:#c9c9c9;margin:0">Der Empfang Ihrer Nachricht wurde bestätigt. Sie können dieses Fenster schließen.</p></div></body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
      );
    }
  } catch (_e) {
    // Lesesignal darf niemals die Bildauslieferung stoeren
  }

  return pixelResponse;
});
