-- 1) Rechnungsentwürfe
CREATE TABLE IF NOT EXISTS public.fc_invoice_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.fc_cases(id) ON DELETE CASCADE,
  order_id uuid,
  customer_id uuid,
  customer_name text,
  reference_number text,
  draft_type text NOT NULL DEFAULT 'voll',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'entwurf',
  invoice_number text,
  note text,
  created_by uuid,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fc_invoice_drafts TO authenticated;
GRANT ALL ON public.fc_invoice_drafts TO service_role;

ALTER TABLE public.fc_invoice_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fc_drafts_read" ON public.fc_invoice_drafts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fc_drafts_insert" ON public.fc_invoice_drafts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fc_drafts_update" ON public.fc_invoice_drafts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fc_drafts_delete_superadmin" ON public.fc_invoice_drafts
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
             WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin')
  );

CREATE INDEX IF NOT EXISTS idx_fc_drafts_case ON public.fc_invoice_drafts(case_id);
CREATE INDEX IF NOT EXISTS idx_fc_drafts_order ON public.fc_invoice_drafts(order_id);
CREATE INDEX IF NOT EXISTS idx_fc_drafts_status ON public.fc_invoice_drafts(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fc_drafts_open_case
  ON public.fc_invoice_drafts(case_id) WHERE status = 'entwurf';

DROP TRIGGER IF EXISTS trg_fc_drafts_touch ON public.fc_invoice_drafts;
CREATE TRIGGER trg_fc_drafts_touch BEFORE UPDATE ON public.fc_invoice_drafts
  FOR EACH ROW EXECUTE FUNCTION public.fc_touch_updated_at();

-- 2) Offener Fakturierungsbetrag eines Auftrags
CREATE OR REPLACE FUNCTION public.fc_order_invoice_gap(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM public.fc_order_financials(p_order_id);
  IF NOT FOUND THEN RETURN 0; END IF;
  RETURN GREATEST(ROUND(COALESCE(f.order_amount,0) - COALESCE(f.invoiced,0), 2), 0);
END; $$;

-- 3) Entwurf zu einem Vorgang erzeugen (anteilig bei Teillieferung)
CREATE OR REPLACE FUNCTION public.fc_create_invoice_draft(p_case_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE c record; v_amount numeric; v_type text; v_open numeric; v_id uuid; v_setting text;
BEGIN
  SELECT value INTO v_setting FROM public.app_settings WHERE key = 'fc_auto_draft' LIMIT 1;
  IF lower(COALESCE(v_setting,'on')) = 'off' THEN RETURN NULL; END IF;

  SELECT * INTO c FROM public.fc_cases WHERE id = p_case_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF COALESCE(c.open_to_invoice,0) <= 0.01 THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.fc_invoice_drafts d WHERE d.case_id = p_case_id AND d.status = 'entwurf') THEN
    RETURN NULL;
  END IF;

  v_open := c.open_to_invoice;
  v_amount := v_open;
  v_type := CASE WHEN c.case_type = 'REPARATUR' THEN 'reparatur'
                 WHEN c.case_type = 'TEILLIEFERUNG' THEN 'anteilig' ELSE 'voll' END;

  IF v_type = 'anteilig' THEN
    SELECT LEAST(v_open, GREATEST(ROUND(COALESCE(c.order_amount,0) - COALESCE(da.open_amount,0) - COALESCE(c.invoiced_amount,0), 2), 0))
      INTO v_amount
      FROM public.delivery_appointments da
     WHERE da.id = c.source_id;
    IF COALESCE(v_amount,0) <= 0.01 THEN v_amount := v_open; END IF;
  END IF;

  INSERT INTO public.fc_invoice_drafts (
    case_id, order_id, customer_id, customer_name, reference_number,
    draft_type, amount, status, created_by, tenant_id, note
  ) VALUES (
    c.id, c.order_id, c.customer_id, c.customer_name, c.reference_number,
    v_type, ROUND(COALESCE(v_amount,0),2), 'entwurf', auth.uid(), c.tenant_id,
    'Automatisch erzeugt (' || c.trigger_event || ')'
  ) RETURNING id INTO v_id;

  INSERT INTO public.fc_events (case_id, event_type, new_status, comment, user_id)
  VALUES (c.id, 'rechnungsentwurf', c.status,
          'Rechnungsentwurf automatisch erzeugt: ' || to_char(ROUND(COALESCE(v_amount,0),2),'FM999G999G990D00') || ' EUR (' || v_type || ')',
          auth.uid());
  RETURN v_id;
END; $$;

-- 4) Automatik: Entwurf sobald ein Vorgang Fakturierung benötigt
CREATE OR REPLACE FUNCTION public.fc_case_autodraft()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.open_to_invoice,0) > 0.01
     AND NEW.status NOT IN ('abgeschlossen','rechnung_zurueckgestellt','rechnung_vorhanden')
     AND COALESCE(NEW.billing_flag,'') NOT IN ('garantie','kulanz') THEN
    PERFORM public.fc_create_invoice_draft(NEW.id);
  ELSIF COALESCE(NEW.open_to_invoice,0) <= 0.01 THEN
    UPDATE public.fc_invoice_drafts SET status = 'erstellt', updated_at = now()
     WHERE case_id = NEW.id AND status = 'entwurf';
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_fc_case_autodraft ON public.fc_cases;
CREATE TRIGGER trg_fc_case_autodraft
AFTER INSERT OR UPDATE OF open_to_invoice, status ON public.fc_cases
FOR EACH ROW EXECUTE FUNCTION public.fc_case_autodraft();

-- 5) Harte Abschluss-Sperre auf Auftragsebene
CREATE OR REPLACE FUNCTION public.fc_block_order_close()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s_new text; s_old text; v_gap numeric; v_setting text;
BEGIN
  s_new := lower(COALESCE(NEW.order_status,''));
  s_old := lower(COALESCE(OLD.order_status,''));
  IF s_new = s_old THEN RETURN NEW; END IF;
  IF s_new NOT IN ('geschlossen','abgeschlossen','closed') THEN RETURN NEW; END IF;

  SELECT value INTO v_setting FROM public.app_settings WHERE key = 'fc_close_block' LIMIT 1;
  IF lower(COALESCE(v_setting,'on')) = 'off' THEN RETURN NEW; END IF;

  v_gap := public.fc_order_invoice_gap(NEW.id);
  IF v_gap > 0.01 THEN
    RAISE EXCEPTION 'Abschluss nicht möglich: Für Auftrag % fehlt noch eine Rechnung über % EUR. Bitte zuerst in BUCHHALTUNG → Finance Controlling fakturieren.',
      COALESCE(NEW.order_number,''), to_char(v_gap,'FM999G999G990D00');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fc_block_order_close ON public.orders;
CREATE TRIGGER trg_fc_block_order_close
BEFORE UPDATE OF order_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fc_block_order_close();

-- 6) Audit-Protokoll beim endgültigen Abschluss
CREATE OR REPLACE FUNCTION public.fc_log_order_close()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s_new text; s_old text; c record;
BEGIN
  s_new := lower(COALESCE(NEW.order_status,''));
  s_old := lower(COALESCE(OLD.order_status,''));
  IF s_new = s_old OR s_new NOT IN ('geschlossen','abgeschlossen','closed') THEN RETURN NEW; END IF;
  FOR c IN SELECT id FROM public.fc_cases WHERE order_id = NEW.id LOOP
    INSERT INTO public.fc_events (case_id, event_type, comment, user_id)
    VALUES (c.id, 'auftrag_abgeschlossen',
            'Auftrag ' || COALESCE(NEW.order_number,'') || ' endgültig abgeschlossen (Rechnungsprüfung bestanden)',
            auth.uid());
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fc_log_order_close ON public.orders;
CREATE TRIGGER trg_fc_log_order_close
AFTER UPDATE OF order_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fc_log_order_close();

-- 7) Entwürfe bei Rechnungseingang schließen
CREATE OR REPLACE FUNCTION public.fc_refresh_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM public.fc_order_financials(p_order_id);
  UPDATE public.fc_cases c SET
    order_amount = f.order_amount,
    invoiced_amount = f.invoiced,
    paid_amount = f.paid,
    open_to_invoice = GREATEST(ROUND(f.order_amount - f.invoiced, 2), 0),
    open_to_pay = GREATEST(ROUND(f.invoiced - f.paid, 2), 0),
    traffic = CASE WHEN c.status IN ('freigegeben','abgeschlossen') THEN c.traffic
                   WHEN ROUND(f.order_amount - f.invoiced, 2) <= 0.01 THEN 'gruen'
                   WHEN c.priority = 'kritisch' THEN 'kritisch' ELSE 'rot' END,
    updated_at = now()
  WHERE c.order_id = p_order_id
    AND c.case_type <> 'REPARATUR';

  UPDATE public.fc_invoice_drafts d SET status = 'erstellt', updated_at = now()
   WHERE d.order_id = p_order_id AND d.status = 'entwurf'
     AND GREATEST(ROUND(f.order_amount - f.invoiced, 2), 0) <= 0.01;
END; $$;