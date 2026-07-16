import { supabase } from '@/integrations/supabase/client';

export type PortalAuditAction =
  | 'login_requested'
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'invoice_opened'
  | 'invoice_downloaded'
  | 'profile_opened'
  | 'data_change_requested'
  | 'session_expired'
  | 'device_viewed'
  | 'device_document_downloaded'
  | 'contract_viewed'
  | 'ticket_viewed'
  | 'ticket_created'
  | 'ticket_replied'
  | 'ticket_closed'
  | 'ticket_rate_limited'
  | 'offer_accepted'
  | 'offer_declined'
  | 'contract_signed'
  | 'message_sent'
  | 'maintenance_requested'
  | 'document_downloaded'
  | 'gdpr_request_created';

export async function logPortalAudit(params: {
  action: PortalAuditAction;
  customerId?: string | null;
  authUserId?: string | null;
  objectType?: string;
  objectId?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
}) {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    await supabase.from('customer_portal_audit_logs').insert({
      action: params.action,
      customer_id: params.customerId ?? null,
      auth_user_id: params.authUserId ?? null,
      object_type: params.objectType ?? null,
      object_id: params.objectId ?? null,
      success: params.success ?? true,
      user_agent: ua,
      metadata: (params.metadata ?? {}) as any,
    });
  } catch {
    // Audit darf UX nie blockieren
  }
}
