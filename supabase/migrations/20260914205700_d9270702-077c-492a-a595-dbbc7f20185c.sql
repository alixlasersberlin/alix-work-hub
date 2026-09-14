-- =========================================================
-- GoBD Phase 2 (Unveränderbarkeit) + Phase 11 (Periodensperre)
-- Rein additiv. Keine Änderung bestehender Rechnungsdaten.
-- =========================================================

-- 1) Audit-Tabelle für Rechnungsereignisse (WORM)
CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid,
  invoice_number text,
  tenant_id uuid,
  user_id uuid,
  action text NOT NULL,
  reason text,
  related_invoice_id uuid,
  fields text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.invoice_audit_log TO authenticated;
GRANT ALL ON public.invoice_audit_log TO service_role;
ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inv_audit_select ON public.invoice_audit_log;
CREATE POLICY inv_audit_select ON public.invoice_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role('Super Admin') OR public.has_role('Admin')
         OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung EU')
         OR public.has_role('Buchhaltung CH') OR public.has_role('Finance'));

DROP POLICY IF EXISTS inv_audit_insert ON public.invoice_audit_log;
CREATE POLICY inv_audit_insert ON public.invoice_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_invoice_audit_invoice ON public.invoice_audit_log(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_action ON public.invoice_audit_log(action, created_at DESC);

-- 2) Korrektur-/Storno-Verknüpfung
CREATE TABLE IF NOT EXISTS public.invoice_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_invoice_id uuid NOT NULL,
  correction_invoice_id uuid,
  correction_type text NOT NULL CHECK (correction_type IN ('storno','gutschrift','berichtigung')),
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.invoice_corrections TO authenticated;
GRANT ALL ON public.invoice_corrections TO service_role;
ALTER TABLE public.invoice_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inv_corr_select ON public.invoice_corrections;
CREATE POLICY inv_corr_select ON public.invoice_corrections
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS inv_corr_insert ON public.invoice_corrections;
CREATE POLICY inv_corr_insert ON public.invoice_corrections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_inv_corr_original ON public.invoice_corrections(original_invoice_id);

-- 3) Hilfsfunktionen
CREATE OR REPLACE FUNCTION public.gobd_invoice_is_final(_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(lower(btrim(_status)), 'draft') NOT IN ('draft','entwurf','');
$$;

CREATE OR REPLACE FUNCTION public.gobd_period_state(_region accounting_region, _dt date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT CASE WHEN p.status IN ('hard_locked','geschlossen','closed','abgeschlossen')
                THEN 'hard_locked' ELSE p.status END
    FROM public.finance_periods p
    WHERE p.accounting_region = coalesce(_region, 'EU'::accounting_region)
      AND p.fiscal_year = EXTRACT(YEAR FROM _dt)::int
      AND p.period_month = EXTRACT(MONTH FROM _dt)::int
    LIMIT 1), 'open');
$$;

CREATE OR REPLACE FUNCTION public.gobd_is_service_context()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''
  ) = 'service_role' OR current_user = 'service_role';
$$;

-- 4) Sperr-Trigger auf Ausgangsrechnungen
CREATE OR REPLACE FUNCTION public.gobd_invoice_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service boolean := public.gobd_is_service_context();
  v_final boolean;
  v_changed text[] := '{}';
  v_locked boolean;
  f text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.invoice_date IS NOT NULL AND NOT v_service
       AND public.gobd_period_state(NEW.accounting_region, NEW.invoice_date) = 'hard_locked' THEN
      RAISE EXCEPTION 'GoBD: Periode % (%) ist hart gesperrt. Keine neue Rechnung in dieser Periode.',
        to_char(NEW.invoice_date, 'YYYY-MM'), NEW.accounting_region;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF public.gobd_invoice_is_final(OLD.status) AND NOT v_service THEN
      RAISE EXCEPTION 'GoBD: Finalisierte Rechnung % darf nicht geloescht werden. Bitte Storno/Gutschrift verwenden.',
        coalesce(OLD.legal_invoice_number, OLD.invoice_number, OLD.id::text);
    END IF;
    RETURN OLD;
  END IF;

  v_final := public.gobd_invoice_is_final(OLD.status);
  IF NOT v_final THEN
    RETURN NEW;
  END IF;

  FOREACH f IN ARRAY ARRAY['invoice_number','legal_invoice_number','beleg_id','invoice_date',
                           'customer_id','customer_name','billing_address','city','currency',
                           'total','due_date','raw_data','accounting_region','is_deposit',
                           'reference_number'] LOOP
    IF to_jsonb(NEW) -> f IS DISTINCT FROM to_jsonb(OLD) -> f THEN
      v_changed := v_changed || f;
    END IF;
  END LOOP;

  IF NOT public.gobd_invoice_is_final(NEW.status) THEN
    v_changed := v_changed || 'status (final -> Entwurf)';
  END IF;

  v_locked := OLD.invoice_date IS NOT NULL
              AND public.gobd_period_state(OLD.accounting_region, OLD.invoice_date) = 'hard_locked';

  IF v_locked AND NOT v_service AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_changed := v_changed || 'status (gesperrte Periode)';
  END IF;

  IF array_length(v_changed, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_service THEN
    INSERT INTO public.invoice_audit_log(invoice_id, invoice_number, tenant_id, user_id, action, fields, metadata)
    VALUES (OLD.id, coalesce(OLD.legal_invoice_number, OLD.invoice_number), OLD.tenant_id, auth.uid(),
            'INVOICE_SYSTEM_SYNC_CHANGE', v_changed,
            jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;
  END IF;

  IF v_locked THEN
    RAISE EXCEPTION 'GoBD: Periode % ist hart gesperrt. Aenderung der Rechnung % abgewiesen (Felder: %).',
      to_char(OLD.invoice_date, 'YYYY-MM'),
      coalesce(OLD.legal_invoice_number, OLD.invoice_number, OLD.id::text),
      array_to_string(v_changed, ', ');
  END IF;

  RAISE EXCEPTION 'GoBD: Rechnung % ist finalisiert. Gesperrte Felder: %. Korrektur nur per Storno/Gutschrift/Berichtigung.',
    coalesce(OLD.legal_invoice_number, OLD.invoice_number, OLD.id::text),
    array_to_string(v_changed, ', ');
END;
$$;

DROP TRIGGER IF EXISTS trg_gobd_invoice_guard ON public.zoho_invoices;
CREATE TRIGGER trg_gobd_invoice_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.zoho_invoices
FOR EACH ROW EXECUTE FUNCTION public.gobd_invoice_guard();

-- 5) Protokoll-RPC für die Anwendung (inkl. abgewiesener Aenderungen)
CREATE OR REPLACE FUNCTION public.gobd_log_invoice_event(
  _invoice_id uuid,
  _action text,
  _reason text DEFAULT NULL,
  _related_invoice_id uuid DEFAULT NULL,
  _fields text[] DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_num text; v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet.'; END IF;
  IF _action NOT IN ('INVOICE_CREATED','INVOICE_FINALIZED','INVOICE_SENT',
                     'INVOICE_CANCELLATION_CREATED','INVOICE_CORRECTION_CREATED',
                     'INVOICE_CHANGE_REJECTED') THEN
    RAISE EXCEPTION 'Unbekannte Aktion: %', _action;
  END IF;
  SELECT coalesce(legal_invoice_number, invoice_number), tenant_id INTO v_num, v_tenant
    FROM public.zoho_invoices WHERE id = _invoice_id;
  INSERT INTO public.invoice_audit_log(invoice_id, invoice_number, tenant_id, user_id, action, reason,
                                       related_invoice_id, fields, metadata)
  VALUES (_invoice_id, v_num, v_tenant, auth.uid(), _action, _reason, _related_invoice_id,
          _fields, coalesce(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gobd_log_invoice_event(uuid, text, text, uuid, text[], jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gobd_log_invoice_event(uuid, text, text, uuid, text[], jsonb) TO authenticated;

-- 6) Korrektur/Storno anlegen (Verknuepfung + Protokoll)
CREATE OR REPLACE FUNCTION public.create_invoice_correction(
  _original_invoice_id uuid,
  _correction_type text,
  _reason text,
  _correction_invoice_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet.'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'Begruendung ist Pflicht.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.zoho_invoices WHERE id = _original_invoice_id) THEN
    RAISE EXCEPTION 'Originalrechnung nicht gefunden.';
  END IF;

  INSERT INTO public.invoice_corrections(original_invoice_id, correction_invoice_id, correction_type, reason, created_by)
  VALUES (_original_invoice_id, _correction_invoice_id, lower(_correction_type), _reason, auth.uid())
  RETURNING id INTO v_id;

  PERFORM public.gobd_log_invoice_event(
    _original_invoice_id,
    CASE WHEN lower(_correction_type) = 'storno' THEN 'INVOICE_CANCELLATION_CREATED'
         ELSE 'INVOICE_CORRECTION_CREATED' END,
    _reason, _correction_invoice_id, NULL,
    jsonb_build_object('correction_type', lower(_correction_type), 'correction_id', v_id));

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invoice_correction(uuid, text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_correction(uuid, text, text, uuid) TO authenticated;

-- 7) Periodensperre: Statuswerte korrigieren (hard_locked wirkt jetzt wirklich)
CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dt date;
  v_region accounting_region;
BEGIN
  IF public.has_role('Super Admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_dt := OLD.booking_date; v_region := OLD.accounting_region;
  ELSE
    v_dt := NEW.booking_date; v_region := NEW.accounting_region;
  END IF;

  IF v_dt IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  v_region := COALESCE(v_region, 'EU'::accounting_region);

  IF public.gobd_period_state(v_region, v_dt) = 'hard_locked' THEN
    RAISE EXCEPTION 'Periode %-% (%) ist hart gesperrt. Buchung gesperrt.',
      EXTRACT(YEAR FROM v_dt)::int, LPAD(EXTRACT(MONTH FROM v_dt)::text, 2, '0'), v_region;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8) Wiederoeffnen einer hart gesperrten Periode: Rolle + Begruendung + Protokoll
CREATE OR REPLACE FUNCTION public.gobd_period_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'hard_locked' AND NEW.status IS DISTINCT FROM 'hard_locked' THEN
    IF NOT (public.has_role('Super Admin') OR public.has_role('Buchhaltung Admin')) THEN
      RAISE EXCEPTION 'GoBD: Nur Super Admin oder Buchhaltung Admin darf eine hart gesperrte Periode wieder oeffnen.';
    END IF;
    IF coalesce(btrim(NEW.note), '') = '' THEN
      RAISE EXCEPTION 'GoBD: Begruendung (Notiz) ist beim Wiederoeffnen einer gesperrten Periode Pflicht.';
    END IF;
    NEW.reopened_at := now();
    NEW.reopened_by := auth.uid();
    INSERT INTO public.finance_audit_trail(module, entity_table, entity_id, action, old_data, new_data, user_id, accounting_region)
    VALUES ('gobd', 'finance_periods', NEW.id, 'ACCOUNTING_PERIOD_REOPENED',
            to_jsonb(OLD), to_jsonb(NEW), auth.uid(), NEW.accounting_region);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.finance_audit_trail(module, entity_table, entity_id, action, old_data, new_data, user_id, accounting_region)
    VALUES ('gobd', 'finance_periods', NEW.id, 'ACCOUNTING_PERIOD_STATUS_CHANGED',
            to_jsonb(OLD), to_jsonb(NEW), auth.uid(), NEW.accounting_region);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gobd_period_guard ON public.finance_periods;
CREATE TRIGGER trg_gobd_period_guard
BEFORE UPDATE ON public.finance_periods
FOR EACH ROW EXECUTE FUNCTION public.gobd_period_guard();