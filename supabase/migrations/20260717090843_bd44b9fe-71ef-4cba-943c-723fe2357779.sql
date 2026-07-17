
CREATE OR REPLACE FUNCTION public.sig_approval_notify_approver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.current_approver IS NULL OR NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.current_approver IS NOT DISTINCT FROM NEW.current_approver
     AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(d.title, 'Signaturanfrage')
    INTO v_title
    FROM public.sig_requests r
    LEFT JOIN public.sig_documents d ON d.id = r.document_id
   WHERE r.id = NEW.request_id;

  INSERT INTO public.app_notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.current_approver,
    'sig_approval_pending',
    'Signatur-Freigabe erforderlich',
    COALESCE(v_title, 'Signaturanfrage') || ' – Schritt ' || (NEW.current_step + 1),
    '/signaturen/genehmigungen',
    jsonb_build_object('request_id', NEW.request_id, 'state_id', NEW.id, 'step', NEW.current_step)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sig_approval_notify ON public.sig_approval_states;
CREATE TRIGGER trg_sig_approval_notify
  AFTER INSERT OR UPDATE ON public.sig_approval_states
  FOR EACH ROW EXECUTE FUNCTION public.sig_approval_notify_approver();
