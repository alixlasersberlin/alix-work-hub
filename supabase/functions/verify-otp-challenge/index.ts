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
      verified_at: new Date().toISOString(),
      disabled: true,
      message: "Die Zwei-Faktor-Authentifizierung ist deaktiviert.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("verify-otp-challenge noop error:", error);
    return new Response(JSON.stringify({
      success: true,
      verified_at: new Date().toISOString(),
      disabled: true,
      message: "Die Zwei-Faktor-Authentifizierung ist deaktiviert.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
