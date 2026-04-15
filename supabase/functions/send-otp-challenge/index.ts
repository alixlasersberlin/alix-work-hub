const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    return new Response(JSON.stringify({
      success: true,
      disabled: true,
      channel: "none",
      destination_hint: "2FA deaktiviert",
      message: "Die Zwei-Faktor-Authentifizierung ist deaktiviert.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-otp-challenge noop error:", error);
    return new Response(JSON.stringify({
      success: true,
      disabled: true,
      channel: "none",
      destination_hint: "2FA deaktiviert",
      message: "Die Zwei-Faktor-Authentifizierung ist deaktiviert.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
