/** Run metadata is not an identity or an authorized delivery destination. */
export async function automationContact(sb: any, contactId: string, tenantIds: string[] | null) {
  let q = sb.from('ac_contacts').select('id,full_name,email,phone,customer_id,tenant_id,tags,attributes').eq('id', contactId);
  if (tenantIds) q = q.in('tenant_id', tenantIds);
  const { data, error } = await q.maybeSingle();
  if (error || !data || data.id !== contactId || (tenantIds && !tenantIds.includes(data.tenant_id))) {
    throw new Error('Contact not found in authorized scope');
  }
  return { ...data, name: data.full_name ?? '' };
}

export function trustedAutomationContext(contact: Record<string, any>, metadata: Record<string, any> = {}) {
  // Keep custom condition variables, but let the current authorized record win.
  return { ...metadata, ...contact };
}