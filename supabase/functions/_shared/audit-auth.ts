import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type AuditUser = {
  id: string;
  email: string | null;
};

export { corsHeaders };

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function createAuditServiceClient() {
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init = {}) => {
        const headers = new Headers(init.headers);
        headers.set("apikey", serviceKey);

        // New Supabase secret keys are opaque (`sb_secret_...`) and must not be
        // sent as a Bearer token. If the SDK adds that default Authorization
        // header, remove only that exact header and keep real user JWTs out of
        // the privileged writer entirely.
        if (serviceKey.startsWith("sb_secret_") && headers.get("Authorization") === `Bearer ${serviceKey}`) {
          headers.delete("Authorization");
        }

        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function requireAuditUser(req: Request): Promise<{ user: AuditUser } | { response: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const authClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await authClient.auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims?.sub) {
    return { response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  return {
    user: {
      id: String(claims.sub),
      email: typeof claims.email === "string" ? claims.email : null,
    },
  };
}