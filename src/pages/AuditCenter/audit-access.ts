import { supabase } from "@/integrations/supabase/client";

export async function logAuditAccess(section: string, filter: Record<string, unknown> = {}, targetUserId?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("audit_access_log").insert({
      viewer_id: user.id,
      viewer_email: user.email ?? null,
      section,
      target_user_id: targetUserId ?? null,
      filter: filter as any,
    });
  } catch {}
}
