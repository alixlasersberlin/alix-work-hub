
CREATE TABLE public.finance_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('alixwork','zoho')),
  source_ref text,
  deposit_number text,
  customer_id uuid,
  customer_name text,
  company_name text,
  contact_name text,
  offer_id uuid,
  offer_number text,
  order_id uuid,
  order_number text,
  invoice_id uuid,
  invoice_number text,
  currency text DEFAULT 'EUR',
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  open_amount numeric(14,2) GENERATED ALWAYS AS (GREATEST(gross_amount - paid_amount, 0)) STORED,
  issue_date date,
  due_date date,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','ueberfaellig','teilweise','gebucht')),
  release_status text NOT NULL DEFAULT 'nicht_freigegeben' CHECK (release_status IN ('nicht_freigegeben','wartet','teilweise','auto_freigegeben','manuell_freigegeben','gesperrt')),
  finance_lock boolean NOT NULL DEFAULT false,
  released_at timestamptz,
  released_by uuid,
  responsible_user_id uuid,
  note text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (source, source_ref)
);
CREATE INDEX idx_finance_deposits_status ON public.finance_deposits(status);
CREATE INDEX idx_finance_deposits_release ON public.finance_deposits(release_status);
CREATE INDEX idx_finance_deposits_order ON public.finance_deposits(order_id);
CREATE INDEX idx_finance_deposits_customer ON public.finance_deposits(customer_id);
CREATE INDEX idx_finance_deposits_due ON public.finance_deposits(due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_deposits TO authenticated;
GRANT ALL ON public.finance_deposits TO service_role;
ALTER TABLE public.finance_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_deposits_select" ON public.finance_deposits FOR SELECT TO authenticated USING (public.can_view_finance_module());
CREATE POLICY "finance_deposits_insert" ON public.finance_deposits FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
CREATE POLICY "finance_deposits_update" ON public.finance_deposits FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
CREATE POLICY "finance_deposits_delete" ON public.finance_deposits FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.finance_deposit_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES public.finance_deposits(id) ON DELETE CASCADE,
  booking_date date NOT NULL DEFAULT current_date,
  paid_amount numeric(14,2) NOT NULL CHECK (paid_amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('ueberweisung','bar','ec','kreditkarte','sonstige')),
  payment_reference text,
  proof_file_path text,
  note text,
  booked_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_deposit_bookings_deposit ON public.finance_deposit_bookings(deposit_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_deposit_bookings TO authenticated;
GRANT ALL ON public.finance_deposit_bookings TO service_role;
ALTER TABLE public.finance_deposit_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_deposit_bookings_select" ON public.finance_deposit_bookings FOR SELECT TO authenticated USING (public.can_view_finance_module());
CREATE POLICY "finance_deposit_bookings_insert" ON public.finance_deposit_bookings FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
CREATE POLICY "finance_deposit_bookings_update" ON public.finance_deposit_bookings FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
CREATE POLICY "finance_deposit_bookings_delete" ON public.finance_deposit_bookings FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE public.finance_deposit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES public.finance_deposits(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_status text,
  new_status text,
  old_release_status text,
  new_release_status text,
  user_id uuid DEFAULT auth.uid(),
  note text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_deposit_history_deposit ON public.finance_deposit_history(deposit_id);
GRANT SELECT, INSERT ON public.finance_deposit_history TO authenticated;
GRANT ALL ON public.finance_deposit_history TO service_role;
ALTER TABLE public.finance_deposit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_deposit_history_select" ON public.finance_deposit_history FOR SELECT TO authenticated USING (public.can_view_finance_module());
CREATE POLICY "finance_deposit_history_insert" ON public.finance_deposit_history FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());

CREATE TABLE public.finance_deposit_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES public.finance_deposits(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('internal','email','sms','teams','slack','threecx')),
  recipient text,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  sent_at timestamptz,
  error text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finance_deposit_notifications_status ON public.finance_deposit_notifications(status);
GRANT SELECT, INSERT, UPDATE ON public.finance_deposit_notifications TO authenticated;
GRANT ALL ON public.finance_deposit_notifications TO service_role;
ALTER TABLE public.finance_deposit_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_deposit_notifications_select" ON public.finance_deposit_notifications FOR SELECT TO authenticated USING (public.can_view_finance_module());
CREATE POLICY "finance_deposit_notifications_insert" ON public.finance_deposit_notifications FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
CREATE POLICY "finance_deposit_notifications_update" ON public.finance_deposit_notifications FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());

CREATE TRIGGER trg_finance_deposits_updated_at
BEFORE UPDATE ON public.finance_deposits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.finance_deposit_recalc(_deposit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_sum numeric(14,2);
  v_dep public.finance_deposits%ROWTYPE;
  v_order_status text;
  v_new_status text;
  v_new_release text;
  v_should_release boolean := false;
BEGIN
  SELECT * INTO v_dep FROM public.finance_deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(SUM(paid_amount),0) INTO v_sum FROM public.finance_deposit_bookings WHERE deposit_id = _deposit_id;

  IF v_sum <= 0 THEN
    IF v_dep.due_date IS NOT NULL AND v_dep.due_date < current_date THEN v_new_status := 'ueberfaellig';
    ELSE v_new_status := 'offen'; END IF;
  ELSIF v_sum >= v_dep.gross_amount AND v_dep.gross_amount > 0 THEN
    v_new_status := 'gebucht';
  ELSE
    v_new_status := 'teilweise';
  END IF;

  IF v_dep.finance_lock THEN v_new_release := 'gesperrt';
  ELSIF v_dep.release_status = 'manuell_freigegeben' THEN v_new_release := 'manuell_freigegeben';
  ELSIF v_new_status = 'gebucht' THEN
    IF v_dep.order_id IS NOT NULL THEN
      SELECT order_status INTO v_order_status FROM public.orders WHERE id = v_dep.order_id;
      IF v_order_status IS NULL OR v_order_status IN ('storniert','abgesagt','geliefert') THEN
        v_new_release := 'nicht_freigegeben';
      ELSE
        v_new_release := 'auto_freigegeben'; v_should_release := true;
      END IF;
    ELSE
      v_new_release := 'auto_freigegeben'; v_should_release := true;
    END IF;
  ELSIF v_new_status = 'teilweise' THEN v_new_release := 'teilweise';
  ELSE v_new_release := 'wartet';
  END IF;

  UPDATE public.finance_deposits
     SET paid_amount = v_sum,
         status = v_new_status,
         release_status = v_new_release,
         released_at = CASE WHEN v_should_release AND released_at IS NULL THEN now() ELSE released_at END,
         released_by = CASE WHEN v_should_release AND released_by IS NULL THEN auth.uid() ELSE released_by END,
         updated_at = now()
   WHERE id = _deposit_id;

  IF v_dep.status IS DISTINCT FROM v_new_status OR v_dep.release_status IS DISTINCT FROM v_new_release THEN
    INSERT INTO public.finance_deposit_history(deposit_id, action, old_status, new_status, old_release_status, new_release_status, user_id, note)
    VALUES (_deposit_id, 'recalc', v_dep.status, v_new_status, v_dep.release_status, v_new_release, auth.uid(), 'Statusaktualisierung');
  END IF;

  IF v_should_release AND v_dep.release_status IS DISTINCT FROM 'auto_freigegeben' THEN
    INSERT INTO public.finance_deposit_notifications(deposit_id, channel, subject, body, meta)
    VALUES (_deposit_id, 'internal', 'Neue Bestellung freigegeben',
            'Kunde: ' || COALESCE(v_dep.customer_name,'-') ||
            E'\nAuftrag: ' || COALESCE(v_dep.order_number,'-') ||
            E'\nAnzahlung vollständig eingegangen. Bestellung kann ausgelöst werden.',
            jsonb_build_object('roles', ARRAY['Bestellwesen','Einkauf','Order','Geschäftsführung']));
  END IF;
END; $fn$;

CREATE OR REPLACE FUNCTION public.finance_deposit_bookings_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  PERFORM public.finance_deposit_recalc(COALESCE(NEW.deposit_id, OLD.deposit_id));
  RETURN COALESCE(NEW, OLD);
END; $fn$;

CREATE TRIGGER trg_finance_deposit_bookings_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.finance_deposit_bookings
FOR EACH ROW EXECUTE FUNCTION public.finance_deposit_bookings_after_change();

CREATE OR REPLACE FUNCTION public.finance_deposit_book(
  p_deposit_id uuid, p_amount numeric, p_method text,
  p_reference text DEFAULT NULL, p_booking_date date DEFAULT current_date,
  p_proof_path text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_access_finance_module() THEN RAISE EXCEPTION 'Keine Berechtigung zum Buchen von Anzahlungen'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Betrag muss größer 0 sein'; END IF;
  INSERT INTO public.finance_deposit_bookings(deposit_id, booking_date, paid_amount, payment_method, payment_reference, proof_file_path, note, booked_by)
  VALUES (p_deposit_id, COALESCE(p_booking_date, current_date), p_amount, p_method, p_reference, p_proof_path, p_note, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.finance_deposit_history(deposit_id, action, user_id, note, meta)
  VALUES (p_deposit_id, 'booking_added', auth.uid(),
          'Zahlung gebucht: ' || p_amount::text || ' (' || p_method || ')',
          jsonb_build_object('booking_id', v_id, 'reference', p_reference));
  RETURN v_id;
END; $fn$;

CREATE OR REPLACE FUNCTION public.finance_deposit_set_lock(p_deposit_id uuid, p_lock boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_old public.finance_deposits%ROWTYPE;
BEGIN
  IF NOT public.can_access_finance_module() THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT * INTO v_old FROM public.finance_deposits WHERE id = p_deposit_id FOR UPDATE;
  UPDATE public.finance_deposits
     SET finance_lock = p_lock,
         release_status = CASE WHEN p_lock THEN 'gesperrt' ELSE 'nicht_freigegeben' END,
         note = COALESCE(p_note, note),
         updated_at = now()
   WHERE id = p_deposit_id;
  INSERT INTO public.finance_deposit_history(deposit_id, action, old_release_status, new_release_status, user_id, note)
  VALUES (p_deposit_id, CASE WHEN p_lock THEN 'lock' ELSE 'unlock' END, v_old.release_status,
          CASE WHEN p_lock THEN 'gesperrt' ELSE 'nicht_freigegeben' END, auth.uid(), p_note);
  PERFORM public.finance_deposit_recalc(p_deposit_id);
END; $fn$;

CREATE OR REPLACE FUNCTION public.finance_deposit_manual_release(p_deposit_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_old public.finance_deposits%ROWTYPE;
BEGIN
  IF NOT public.can_access_finance_module() THEN RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT * INTO v_old FROM public.finance_deposits WHERE id = p_deposit_id FOR UPDATE;
  UPDATE public.finance_deposits
     SET release_status = 'manuell_freigegeben',
         released_at = now(), released_by = auth.uid(), finance_lock = false,
         note = COALESCE(p_note, note), updated_at = now()
   WHERE id = p_deposit_id;
  INSERT INTO public.finance_deposit_history(deposit_id, action, old_release_status, new_release_status, user_id, note)
  VALUES (p_deposit_id, 'manual_release', v_old.release_status, 'manuell_freigegeben', auth.uid(), p_note);
  INSERT INTO public.finance_deposit_notifications(deposit_id, channel, subject, body, meta)
  VALUES (p_deposit_id, 'internal', 'Bestellung manuell freigegeben',
          'Anzahlung wurde manuell freigegeben.',
          jsonb_build_object('roles', ARRAY['Bestellwesen','Einkauf','Order','Geschäftsführung']));
END; $fn$;
