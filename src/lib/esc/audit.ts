// Audit-log interface for ESC.
// Prompt 1 = no-op stub; Prompt 2 will persist to esc_audit_log via supabase.
export interface EscAuditEntry {
  entity: 'appointment' | 'department' | 'employee' | 'resource';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'confirm' | 'reject';
  before?: unknown;
  after?: unknown;
  actorEmail?: string;
  source: 'internal' | 'public_portal' | 'confirmation_link' | 'system';
}

export async function logEscAudit(entry: EscAuditEntry): Promise<void> {
  // Placeholder; Prompt 2 replaces this with a Supabase insert.
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.debug('[esc-audit]', entry);
  }
}
