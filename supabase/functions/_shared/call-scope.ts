/** Calls have no tenant column; prove tenancy through the existing contact. */
export async function callScopeAllowed(access: { caller: any; user: { id: string }; tenants: { id: string }[] }, call: { contact_id?: string | null; agent_user_id?: string | null }) {
  if (!call.contact_id) return call.agent_user_id === access.user.id;
  const { data, error } = await access.caller.from('ac_contacts').select('id')
    .eq('id', call.contact_id).in('tenant_id', access.tenants.map(t => t.id)).maybeSingle();
  return !error && !!data;
}