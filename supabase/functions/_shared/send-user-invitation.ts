import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type AnySupabaseClient = SupabaseClient<any, "public", any>;

interface SendUserInvitationParams {
  adminClient: AnySupabaseClient;
  callerClient: AnySupabaseClient;
  userId: string;
  email: string;
}

export async function sendUserInvitationEmail({
  adminClient,
  callerClient,
  userId,
  email,
}: SendUserInvitationParams) {
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://alix-finance.de";
  const redirectTo = `${siteUrl.replace(/\/$/, "")}/passwort-setzen`;

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (inviteError) {
    const { error: magicErr } = await adminClient.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    });

    if (magicErr) {
      throw new Error(`Invitation send error: ${inviteError.message} / ${magicErr.message}`);
    }
  }

  const {
    data: { user: callerUser },
  } = await callerClient.auth.getUser();

  const { error: invError } = await adminClient.from("user_invitations").insert({
    user_id: userId,
    email,
    invitation_status: "sent",
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: callerUser?.id || null,
  });

  if (invError) {
    console.error("Invitation record error:", invError);
  }

  const { error: profileUpdateError } = await adminClient
    .from("user_profiles")
    .update({ invitation_status: "sent" })
    .eq("id", userId);

  if (profileUpdateError) {
    console.error("Invitation profile update error:", profileUpdateError);
  }

  const { error: auditError } = await adminClient.from("audit_logs").insert({
    user_id: callerUser?.id || null,
    action: "invitation_sent",
    module: "user_management",
    record_id: userId,
    details: { email },
  });

  if (auditError) {
    console.error("Invitation audit error:", auditError);
  }

  return {
    usedMagicLinkFallback: !!inviteError,
  };
}