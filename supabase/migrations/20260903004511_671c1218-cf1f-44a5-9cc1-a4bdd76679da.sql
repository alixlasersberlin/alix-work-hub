CREATE INDEX IF NOT EXISTS idx_zoho_invoices_raw_data_gin ON public.zoho_invoices USING gin (raw_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient_trgm ON public.email_send_log USING gin (recipient_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_desc ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_esc_audit_log_changed_at ON public.esc_audit_log (changed_at DESC);