
CREATE TABLE public.order_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number TEXT,
  requested_by UUID NOT NULL,
  requested_by_name TEXT,
  reason TEXT,
  proposed_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  original_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocr_status ON public.order_change_requests(status, created_at DESC);
CREATE INDEX idx_ocr_order ON public.order_change_requests(order_id);
CREATE INDEX idx_ocr_requester ON public.order_change_requests(requested_by);

GRANT SELECT, INSERT, UPDATE ON public.order_change_requests TO authenticated;
GRANT ALL ON public.order_change_requests TO service_role;

ALTER TABLE public.order_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert own change request"
ON public.order_change_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "read own or superadmin"
ON public.order_change_requests FOR SELECT TO authenticated
USING (auth.uid() = requested_by OR public.has_role('Super Admin'));

CREATE POLICY "superadmin update"
ON public.order_change_requests FOR UPDATE TO authenticated
USING (public.has_role('Super Admin'))
WITH CHECK (public.has_role('Super Admin'));

CREATE POLICY "requester cancel pending"
ON public.order_change_requests FOR UPDATE TO authenticated
USING (auth.uid() = requested_by AND status = 'pending')
WITH CHECK (auth.uid() = requested_by AND status IN ('pending','cancelled'));

CREATE TRIGGER trg_ocr_updated_at
BEFORE UPDATE ON public.order_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_order_change_request(_id UUID, _note TEXT DEFAULT NULL)
RETURNS public.order_change_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.order_change_requests; reviewer_name TEXT;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'forbidden: only Super Admin';
  END IF;
  SELECT * INTO r FROM public.order_change_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'not pending'; END IF;

  UPDATE public.orders o
  SET
    order_status       = COALESCE(r.proposed_changes->>'order_status', o.order_status),
    total_amount       = COALESCE((r.proposed_changes->>'total_amount')::numeric, o.total_amount),
    currency           = COALESCE(r.proposed_changes->>'currency', o.currency),
    salesperson_name   = COALESCE(r.proposed_changes->>'salesperson_name', o.salesperson_name),
    internal_number    = COALESCE(r.proposed_changes->>'internal_number', o.internal_number),
    lawyer_reason      = COALESCE(r.proposed_changes->>'lawyer_reason', o.lawyer_reason),
    vat_display_mode   = COALESCE(r.proposed_changes->>'vat_display_mode', o.vat_display_mode),
    billing_address    = COALESCE(r.proposed_changes->'billing_address', o.billing_address),
    shipping_address   = COALESCE(r.proposed_changes->'shipping_address', o.shipping_address),
    expected_shipment_date = COALESCE((r.proposed_changes->>'expected_shipment_date')::timestamptz, o.expected_shipment_date),
    customer_id        = COALESCE((r.proposed_changes->>'customer_id')::uuid, o.customer_id),
    updated_at         = now()
  WHERE o.id = r.order_id;

  SELECT COALESCE(full_name, email) INTO reviewer_name FROM public.user_profiles WHERE id = auth.uid();

  UPDATE public.order_change_requests
  SET status='approved', reviewed_by=auth.uid(), reviewed_by_name=reviewer_name,
      reviewed_at=now(), review_note=_note, applied_at=now()
  WHERE id=_id
  RETURNING * INTO r;

  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_order_change_request(_id UUID, _note TEXT DEFAULT NULL)
RETURNS public.order_change_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.order_change_requests; reviewer_name TEXT;
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'forbidden: only Super Admin';
  END IF;
  SELECT COALESCE(full_name, email) INTO reviewer_name FROM public.user_profiles WHERE id = auth.uid();
  UPDATE public.order_change_requests
  SET status='rejected', reviewed_by=auth.uid(), reviewed_by_name=reviewer_name,
      reviewed_at=now(), review_note=_note
  WHERE id=_id AND status='pending'
  RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'not found or not pending'; END IF;
  RETURN r;
END; $$;

GRANT EXECUTE ON FUNCTION public.apply_order_change_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_order_change_request(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_order_change_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE u RECORD;
BEGIN
  FOR u IN
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE r.name = 'Super Admin'
  LOOP
    INSERT INTO public.app_notifications(user_id, category, title, message, priority, action_url, metadata)
    VALUES (
      u.user_id, 'order_change_request',
      'Neue Auftrags-Änderung zur Freigabe',
      COALESCE(NEW.requested_by_name, 'Ein Mitarbeiter') || ' möchte Auftrag ' || COALESCE(NEW.order_number,'') || ' ändern.',
      'high', '/freigaben',
      jsonb_build_object('change_request_id', NEW.id, 'order_id', NEW.order_id)
    );
  END LOOP;

  -- E-Mail-Benachrichtigung (best-effort)
  PERFORM net.http_post(
    url := 'https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/notify-order-change-request',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('id', NEW.id, 'event', 'created')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_ocr
AFTER INSERT ON public.order_change_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_order_change_request();

CREATE OR REPLACE FUNCTION public.notify_order_change_request_reviewed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved','rejected') AND OLD.status = 'pending' THEN
    INSERT INTO public.app_notifications(user_id, category, title, message, priority, action_url, metadata)
    VALUES (
      NEW.requested_by, 'order_change_request',
      CASE WHEN NEW.status='approved' THEN 'Auftrags-Änderung freigegeben' ELSE 'Auftrags-Änderung abgelehnt' END,
      'Auftrag ' || COALESCE(NEW.order_number,'') || COALESCE(' – ' || NEW.review_note, ''),
      'normal', '/auftraege/' || NEW.order_id::text,
      jsonb_build_object('change_request_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_ocr_reviewed
AFTER UPDATE ON public.order_change_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_order_change_request_reviewed();
