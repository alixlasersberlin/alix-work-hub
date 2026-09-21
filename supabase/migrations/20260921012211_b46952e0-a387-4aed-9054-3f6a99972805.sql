CREATE OR REPLACE FUNCTION public.op_light_dunning_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Protokolleintraege in % sind unveraenderbar (GoBD).', TG_TABLE_NAME;
  END IF;

  -- Nur das Lesesignal darf nachgetragen werden
  IF ROW(NEW.id, NEW.invoice_id, NEW.invoice_number, NEW.customer_name, NEW.recipient_email,
         NEW.level, NEW.subject, NEW.message, NEW.template, NEW.open_amount, NEW.due_date,
         NEW.send_status, NEW.error_message, NEW.sent_at, NEW.sent_by, NEW.created_at, NEW.track_token)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.invoice_id, OLD.invoice_number, OLD.customer_name, OLD.recipient_email,
         OLD.level, OLD.subject, OLD.message, OLD.template, OLD.open_amount, OLD.due_date,
         OLD.send_status, OLD.error_message, OLD.sent_at, OLD.sent_by, OLD.created_at, OLD.track_token)
  THEN
    RAISE EXCEPTION 'Protokolleintraege in % sind unveraenderbar (GoBD).', TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_op_light_dunning_immutable ON public.op_light_dunning_log;
CREATE TRIGGER trg_op_light_dunning_immutable
BEFORE DELETE OR UPDATE ON public.op_light_dunning_log
FOR EACH ROW EXECUTE FUNCTION public.op_light_dunning_immutable();