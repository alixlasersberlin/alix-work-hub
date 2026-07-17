-- Auto-create approval state when a sig_request is created and template has an active approval chain
CREATE OR REPLACE FUNCTION public.sig_requests_apply_approval_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_chain public.sig_approval_chains%ROWTYPE;
  v_first_approver uuid;
BEGIN
  SELECT template_id INTO v_template_id FROM public.sig_documents WHERE id = NEW.document_id;
  IF v_template_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_chain
  FROM public.sig_approval_chains
  WHERE template_id = v_template_id AND active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_chain.id IS NULL OR jsonb_array_length(COALESCE(v_chain.steps, '[]'::jsonb)) = 0 THEN
    RETURN NEW;
  END IF;

  v_first_approver := NULLIF(v_chain.steps->0->>'user_id','')::uuid;

  INSERT INTO public.sig_approval_states (request_id, chain_id, current_step, status, current_approver, history)
  VALUES (NEW.id, v_chain.id, 0, 'pending', v_first_approver, '[]'::jsonb);

  NEW.status := 'awaiting_approval';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sig_requests_apply_chain ON public.sig_requests;
CREATE TRIGGER trg_sig_requests_apply_chain
BEFORE INSERT ON public.sig_requests
FOR EACH ROW EXECUTE FUNCTION public.sig_requests_apply_approval_chain();