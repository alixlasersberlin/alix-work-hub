Deno.serve(async () => {
  const r = await fetch("https://connector-gateway.lovable.dev/resend/domains", {
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": Deno.env.get("RESEND_API_KEY")!,
    },
  });
  return new Response(await r.text(), { status: 200, headers: { "Content-Type": "application/json" } });
});
