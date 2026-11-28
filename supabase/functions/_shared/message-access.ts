// Caller-scoped checks must complete before privileged delivery or media access.
export function activeMessageAccount(profile: Record<string, unknown> | null): boolean {
  return profile?.is_active === true && profile.account_status === 'active'
    && profile.invitation_status === 'accepted' && profile.password_reset_required === false;
}

export async function maySendConversation(client: any, userId: string, conversation: { channel_id: string | null; tenant_id?: string | null }): Promise<boolean> {
  const { data: staff, error: staffError } = await client.rpc('is_internal_staff');
  if (staffError || staff !== true) return false;
  if (conversation.tenant_id) {
    const { data: access, error } = await client.from('user_tenant_access').select('tenant_id').eq('user_id', userId).eq('tenant_id', conversation.tenant_id).maybeSingle();
    if (error || !access) return false;
  }
  if (!conversation.channel_id) return true;
  const { data: member, error } = await client.rpc('ac_is_channel_member', { _channel: conversation.channel_id, _user: userId });
  return !error && member === true;
}