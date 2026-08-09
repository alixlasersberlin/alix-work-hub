import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

// Datei-Format: "ALIXBK1" | salt(16) | iv(12) | AES-256-GCM Ciphertext
const MAGIC = new TextEncoder().encode("ALIXBK1");
const PBKDF2_ITERATIONS = 310_000;

async function encryptPayload(
  plain: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain),
  );
  const out = new Uint8Array(
    MAGIC.length + salt.length + iv.length + cipher.length,
  );
  out.set(MAGIC, 0);
  out.set(salt, MAGIC.length);
  out.set(iv, MAGIC.length + salt.length);
  out.set(cipher, MAGIC.length + salt.length + iv.length);
  return out;
}

function passwordStrengthError(pw: string): string | null {
  if (pw.length < 16) {
    return "Verschlüsselungs-Passwort muss mindestens 16 Zeichen lang sein";
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) =>
    r.test(pw)
  ).length;
  if (classes < 4) {
    return "Verschlüsselungs-Passwort benötigt Groß-, Kleinbuchstaben, Ziffern und Sonderzeichen";
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (req.method !== "POST") {
      return json({ error: "Method not allowed – POST erforderlich" }, 405);
    }

    // 1) Nur mit gültigem Benutzeraccount
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const user = userData.user;

    // 2) Nur Super Admin
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", user.id);
    const roleNames = (roleRows ?? [])
      .map((r: any) => r.roles?.name)
      .filter(Boolean);
    if (!roleNames.includes("Super Admin")) {
      return json({ error: "Forbidden – nur Super Admin" }, 403);
    }

    const body = await req.json().catch(() => ({} as any));
    const backupId: string | null = body.backup_id ?? null;
    const accountPassword: string = body.account_password ?? "";
    const encryptionPassword: string = body.encryption_password ?? "";
    if (!backupId) return json({ error: "backup_id required" }, 400);

    // 3) Re-Auth mit Kontopasswort
    if (!accountPassword || !user.email) {
      return json({ error: "Kontopasswort erforderlich" }, 400);
    }
    const authClient = createClient(supabaseUrl, anonKey);
    const { error: reauthErr } = await authClient.auth.signInWithPassword({
      email: user.email,
      password: accountPassword,
    });
    if (reauthErr) {
      await admin.from("audit_logs").insert({
        user_id: user.id,
        action: "backup_download_denied",
        module: "backups",
        record_id: backupId,
        details: { reason: "reauth_failed" },
      }).then(() => {}, () => {});
      return json({ error: "Kontopasswort ist falsch" }, 401);
    }

    // 4) Starkes Verschlüsselungs-Passwort erzwingen
    const pwErr = passwordStrengthError(encryptionPassword);
    if (pwErr) return json({ error: pwErr }, 400);

    const { data: meta, error: metaErr } = await admin
      .from("backups_metadata")
      .select("id, storage_path, started_at")
      .eq("id", backupId)
      .maybeSingle();
    if (metaErr || !meta) return json({ error: "Backup not found" }, 404);
    if (!meta.storage_path) {
      return json({ error: "Backup has no storage path" }, 400);
    }

    const folderPath = meta.storage_path.replace(/\/manifest\.json$/, "");

    const filesToZip: string[] = [];
    async function walk(prefix: string) {
      const { data, error } = await admin.storage.from("backups").list(prefix, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`List ${prefix}: ${error.message}`);
      for (const entry of data ?? []) {
        if (entry.id === null) {
          await walk(`${prefix}/${entry.name}`);
        } else {
          filesToZip.push(`${prefix}/${entry.name}`);
        }
      }
    }
    await walk(folderPath);

    if (filesToZip.length === 0) {
      return json({ error: "No files in backup folder" }, 404);
    }

    const zip = new JSZip();
    for (const path of filesToZip) {
      const { data: blob, error: dlErr } = await admin.storage
        .from("backups")
        .download(path);
      if (dlErr || !blob) throw new Error(`Download ${path}: ${dlErr?.message}`);
      const relative = path.substring(folderPath.length + 1);
      zip.file(relative, await blob.arrayBuffer());
    }

    const zipBuf = await zip.generateAsync({
      type: "uint8array",
      compression: "STORE",
    });

    // 5) AES-256-GCM Verschlüsselung
    const encrypted = await encryptPayload(zipBuf, encryptionPassword);

    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "backup_download",
      module: "backups",
      record_id: backupId,
      details: { encrypted: true, bytes: encrypted.byteLength },
    }).then(() => {}, () => {});

    const fileName = `backup-${backupId.slice(0, 8)}-${
      (meta.started_at ?? "").slice(0, 10)
    }.zip.enc`;
    return new Response(encrypted, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(encrypted.byteLength),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("download-backup-zip failed:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
