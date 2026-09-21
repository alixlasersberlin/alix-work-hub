ALTER TABLE public.op_light_dunning_log
  ADD COLUMN IF NOT EXISTS track_token uuid,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_op_light_dunning_track_token
  ON public.op_light_dunning_log (track_token) WHERE track_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fibu_light_log_dunning(
  p_invoice_id uuid, p_level smallint, p_recipient text, p_subject text, p_message text,
  p_open_amount numeric DEFAULT NULL::numeric, p_send_status text DEFAULT 'sent'::text,
  p_error text DEFAULT NULL::text, p_track_token uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_inv public.zoho_invoices%ROWTYPE; v_id uuid;
BEGIN
  IF NOT public.can_use_fibu_light() THEN RAISE EXCEPTION 'Keine Berechtigung fuer FIBU LIGHT.'; END IF;
  SELECT * INTO v_inv FROM public.zoho_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rechnung nicht gefunden.'; END IF;

  INSERT INTO public.op_light_dunning_log (invoice_id, invoice_number, customer_name, recipient_email, level,
                                           subject, message, template, open_amount, due_date, send_status, error_message, track_token)
  VALUES (p_invoice_id, coalesce(v_inv.legal_invoice_number, v_inv.invoice_number), v_inv.customer_name,
          p_recipient, p_level, p_subject, p_message, 'finance-reminder',
          coalesce(p_open_amount, v_inv.balance), v_inv.due_date, coalesce(p_send_status, 'sent'), p_error, p_track_token)
  RETURNING id INTO v_id;

  PERFORM public.log_audit_event(
    'FIBU_LIGHT_DUNNING', 'fibu-light', p_invoice_id::text,
    jsonb_build_object('level', p_level, 'recipient', p_recipient, 'status', p_send_status,
                       'invoice_number', coalesce(v_inv.legal_invoice_number, v_inv.invoice_number)),
    NULL, NULL);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fibu_light_last_emails(p_invoice_ids uuid[])
RETURNS TABLE(invoice_id uuid, sent_at timestamptz, level smallint, subject text,
              recipient_email text, send_status text, opened_at timestamptz,
              last_opened_at timestamptz, open_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (l.invoice_id)
         l.invoice_id, coalesce(l.sent_at, l.created_at), l.level, l.subject,
         l.recipient_email, l.send_status, l.opened_at, l.last_opened_at, l.open_count
  FROM public.op_light_dunning_log l
  WHERE l.invoice_id = ANY(p_invoice_ids)
    AND public.can_use_fibu_light()
  ORDER BY l.invoice_id, coalesce(l.sent_at, l.created_at) DESC
$function$;

GRANT EXECUTE ON FUNCTION public.fibu_light_last_emails(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.op_light_mark_email_opened(p_token uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.op_light_dunning_log
     SET opened_at = coalesce(opened_at, now()),
         last_opened_at = now(),
         open_count = coalesce(open_count, 0) + 1
   WHERE track_token = p_token
$function$;