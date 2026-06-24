
-- ============================================================
-- KASSENBUCH & BUCHUNGSJOURNAL PRO  (additiv)
-- ============================================================

-- Sequenzen
CREATE SEQUENCE IF NOT EXISTS public.finance_cashbook_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.finance_journal_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.finance_cashbook_closure_seq START 1;

-- ============================================================
-- 1) finance_cashbook
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_cashbook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text UNIQUE,
  booking_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Berlin')::date,
  booking_time time NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Berlin')::time,
  document_number text,
  booking_type text NOT NULL CHECK (booking_type IN ('einnahme','ausgabe')),
  amount_net numeric(14,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 19,
  amount_vat numeric(14,2) NOT NULL DEFAULT 0,
  amount_gross numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Bar',
  cost_center text,
  description text,
  reference text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  attachment_path text,
  status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','storniert','korrigiert')),
  reverses_id uuid REFERENCES public.finance_cashbook(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cashbook TO authenticated;
GRANT ALL ON public.finance_cashbook TO service_role;
ALTER TABLE public.finance_cashbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashbook_select" ON public.finance_cashbook
  FOR SELECT TO authenticated USING (public.can_view_finance_module());
CREATE POLICY "cashbook_insert" ON public.finance_cashbook
  FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
CREATE POLICY "cashbook_update" ON public.finance_cashbook
  FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
CREATE POLICY "cashbook_delete_superadmin" ON public.finance_cashbook
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_cashbook_date ON public.finance_cashbook(booking_date);
CREATE INDEX IF NOT EXISTS idx_cashbook_status ON public.finance_cashbook(status);

-- ============================================================
-- 2) finance_cashbook_closures
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_cashbook_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_number text UNIQUE,
  closure_date date NOT NULL,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  calculated_balance numeric(14,2) NOT NULL DEFAULT 0,
  counted_balance numeric(14,2) NOT NULL DEFAULT 0,
  difference numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  signature_data text,
  signed_by uuid REFERENCES auth.users(id),
  signed_at timestamptz,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','freigegeben')),
  released_by uuid REFERENCES auth.users(id),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cashbook_closures TO authenticated;
GRANT ALL ON public.finance_cashbook_closures TO service_role;
ALTER TABLE public.finance_cashbook_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "closure_select" ON public.finance_cashbook_closures
  FOR SELECT TO authenticated USING (public.can_view_finance_module());
CREATE POLICY "closure_insert" ON public.finance_cashbook_closures
  FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
CREATE POLICY "closure_update" ON public.finance_cashbook_closures
  FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
CREATE POLICY "closure_delete_superadmin" ON public.finance_cashbook_closures
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

-- ============================================================
-- 3) finance_journal
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_number text UNIQUE,
  booking_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Berlin')::date,
  booking_time time NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Berlin')::time,
  tenant_id uuid,
  source_module text NOT NULL,
  source_table text,
  source_id uuid,
  reference text,
  order_number text,
  invoice_number text,
  document_number text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  vorgang text,
  amount_net numeric(14,2) DEFAULT 0,
  amount_vat numeric(14,2) DEFAULT 0,
  amount_gross numeric(14,2) DEFAULT 0,
  payment_method text,
  account text,
  contra_account text,
  description text,
  status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','storniert','korrigiert')),
  corrects_journal_id uuid REFERENCES public.finance_journal(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_journal TO authenticated;
GRANT ALL ON public.finance_journal TO service_role;
ALTER TABLE public.finance_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_select" ON public.finance_journal
  FOR SELECT TO authenticated USING (public.can_view_finance_module());
CREATE POLICY "journal_insert" ON public.finance_journal
  FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
CREATE POLICY "journal_update" ON public.finance_journal
  FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
CREATE POLICY "journal_delete_superadmin" ON public.finance_journal
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_journal_date ON public.finance_journal(booking_date);
CREATE INDEX IF NOT EXISTS idx_journal_source ON public.finance_journal(source_module, source_id);

-- ============================================================
-- 4) finance_bank_postings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_bank_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Berlin')::date,
  value_date date,
  bank_account_id uuid,
  posting_type text NOT NULL CHECK (posting_type IN ('eingang','ausgang','lastschrift','ruecklastschrift','erstattung')),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  counterparty text,
  iban text,
  purpose text,
  reference text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_id uuid,
  status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','storniert','korrigiert')),
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_bank_postings TO authenticated;
GRANT ALL ON public.finance_bank_postings TO service_role;
ALTER TABLE public.finance_bank_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bankpost_select" ON public.finance_bank_postings
  FOR SELECT TO authenticated USING (public.can_view_finance_module());
CREATE POLICY "bankpost_insert" ON public.finance_bank_postings
  FOR INSERT TO authenticated WITH CHECK (public.can_access_finance_module());
CREATE POLICY "bankpost_update" ON public.finance_bank_postings
  FOR UPDATE TO authenticated USING (public.can_access_finance_module()) WITH CHECK (public.can_access_finance_module());
CREATE POLICY "bankpost_delete_superadmin" ON public.finance_bank_postings
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE INDEX IF NOT EXISTS idx_bankpost_date ON public.finance_bank_postings(posting_date);

-- ============================================================
-- 5) finance_audit_trail
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finance_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid REFERENCES auth.users(id),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.finance_audit_trail TO authenticated;
GRANT ALL ON public.finance_audit_trail TO service_role;
ALTER TABLE public.finance_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fat_select" ON public.finance_audit_trail
  FOR SELECT TO authenticated USING (public.can_view_finance_module());
CREATE POLICY "fat_insert" ON public.finance_audit_trail
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fat_table_id ON public.finance_audit_trail(entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_fat_created ON public.finance_audit_trail(created_at DESC);

-- ============================================================
-- Trigger-Funktionen
-- ============================================================

-- Updated_at-Trigger nutzt bestehende public.set_updated_at()
CREATE TRIGGER trg_cashbook_updated BEFORE UPDATE ON public.finance_cashbook
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_closure_updated BEFORE UPDATE ON public.finance_cashbook_closures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_journal_updated BEFORE UPDATE ON public.finance_journal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bankpost_updated BEFORE UPDATE ON public.finance_bank_postings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Buchungsnummer Kassenbuch
CREATE OR REPLACE FUNCTION public.assign_cashbook_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.booking_number IS NULL OR length(trim(NEW.booking_number)) = 0 THEN
    NEW.booking_number := 'KB-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.finance_cashbook_seq')::text, 5, '0');
  END IF;
  IF NEW.amount_gross = 0 AND (NEW.amount_net <> 0 OR NEW.amount_vat <> 0) THEN
    NEW.amount_gross := NEW.amount_net + NEW.amount_vat;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_assign_cashbook_number BEFORE INSERT ON public.finance_cashbook
  FOR EACH ROW EXECUTE FUNCTION public.assign_cashbook_number();

-- Journalnummer
CREATE OR REPLACE FUNCTION public.assign_journal_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.journal_number IS NULL OR length(trim(NEW.journal_number)) = 0 THEN
    NEW.journal_number := 'JB-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.finance_journal_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_assign_journal_number BEFORE INSERT ON public.finance_journal
  FOR EACH ROW EXECUTE FUNCTION public.assign_journal_number();

-- Closure-Nummer
CREATE OR REPLACE FUNCTION public.assign_closure_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.closure_number IS NULL OR length(trim(NEW.closure_number)) = 0 THEN
    NEW.closure_number := 'KA-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.finance_cashbook_closure_seq')::text, 4, '0');
  END IF;
  NEW.difference := COALESCE(NEW.counted_balance,0) - COALESCE(NEW.calculated_balance,0);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_assign_closure_number BEFORE INSERT OR UPDATE ON public.finance_cashbook_closures
  FOR EACH ROW EXECUTE FUNCTION public.assign_closure_number();

-- Auto-Journaleintrag aus Kassenbuch
CREATE OR REPLACE FUNCTION public.trg_cashbook_to_journal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.finance_journal(
    booking_date, booking_time, source_module, source_table, source_id,
    reference, document_number, customer_id, supplier_id,
    vorgang, amount_net, amount_vat, amount_gross, payment_method,
    account, contra_account, description, status, user_id
  ) VALUES (
    NEW.booking_date, NEW.booking_time, 'cashbook', 'finance_cashbook', NEW.id,
    NEW.booking_number, NEW.document_number, NEW.customer_id, NEW.supplier_id,
    'Kassenbuch ' || NEW.booking_type, NEW.amount_net, NEW.amount_vat, NEW.amount_gross,
    NEW.payment_method, '1600', CASE WHEN NEW.booking_type='einnahme' THEN '8400' ELSE '4980' END,
    COALESCE(NEW.description, NEW.booking_number), NEW.status, NEW.user_id
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_cashbook_to_journal AFTER INSERT ON public.finance_cashbook
  FOR EACH ROW EXECUTE FUNCTION public.trg_cashbook_to_journal();

-- Auto-Journaleintrag aus Bankbuchung
CREATE OR REPLACE FUNCTION public.trg_bankpost_to_journal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_account text; v_contra text;
BEGIN
  v_account := '1200';
  v_contra := CASE
    WHEN NEW.posting_type IN ('eingang','erstattung') THEN '1400'
    WHEN NEW.posting_type IN ('ausgang','lastschrift') THEN '1600'
    WHEN NEW.posting_type = 'ruecklastschrift' THEN '1460'
    ELSE '1590'
  END;
  INSERT INTO public.finance_journal(
    booking_date, source_module, source_table, source_id,
    reference, customer_id, supplier_id, vorgang,
    amount_gross, payment_method, account, contra_account, description, status, user_id
  ) VALUES (
    NEW.posting_date, 'bank', 'finance_bank_postings', NEW.id,
    NEW.reference, NEW.customer_id, NEW.supplier_id,
    'Bank ' || NEW.posting_type, NEW.amount, 'Bank', v_account, v_contra,
    COALESCE(NEW.purpose, NEW.counterparty, NEW.reference), NEW.status, NEW.user_id
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bankpost_to_journal AFTER INSERT ON public.finance_bank_postings
  FOR EACH ROW EXECUTE FUNCTION public.trg_bankpost_to_journal();

-- GoBD: kein physisches Löschen außer Super Admin
CREATE OR REPLACE FUNCTION public.gobd_block_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role('Super Admin') THEN
    RAISE EXCEPTION 'GoBD: Buchungen dürfen nicht gelöscht werden. Bitte stornieren.';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER trg_gobd_cashbook BEFORE DELETE ON public.finance_cashbook
  FOR EACH ROW EXECUTE FUNCTION public.gobd_block_delete();
CREATE TRIGGER trg_gobd_journal BEFORE DELETE ON public.finance_journal
  FOR EACH ROW EXECUTE FUNCTION public.gobd_block_delete();
CREATE TRIGGER trg_gobd_bankpost BEFORE DELETE ON public.finance_bank_postings
  FOR EACH ROW EXECUTE FUNCTION public.gobd_block_delete();

-- Audit-Trigger für neue Tabellen
CREATE OR REPLACE FUNCTION public.finance_audit_trg_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_old jsonb; v_new jsonb; v_id uuid;
BEGIN
  IF TG_OP='INSERT' THEN v_new := to_jsonb(NEW); v_id := NEW.id;
  ELSIF TG_OP='UPDATE' THEN
    IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_id := NEW.id;
  ELSE v_old := to_jsonb(OLD); v_id := OLD.id;
  END IF;
  BEGIN
    INSERT INTO public.finance_audit_trail(module, entity_table, entity_id, action, old_data, new_data, user_id)
    VALUES ('finance', TG_TABLE_NAME, v_id, TG_OP, v_old, v_new, auth.uid());
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_audit_cashbook AFTER INSERT OR UPDATE OR DELETE ON public.finance_cashbook
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trg_fn();
CREATE TRIGGER trg_audit_journal AFTER INSERT OR UPDATE OR DELETE ON public.finance_journal
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trg_fn();
CREATE TRIGGER trg_audit_bankpost AFTER INSERT OR UPDATE OR DELETE ON public.finance_bank_postings
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trg_fn();
CREATE TRIGGER trg_audit_closure AFTER INSERT OR UPDATE OR DELETE ON public.finance_cashbook_closures
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trg_fn();

-- Storno-Helper für Kassenbuch
CREATE OR REPLACE FUNCTION public.cashbook_reverse(_id uuid, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_src public.finance_cashbook%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF NOT public.can_access_finance_module() THEN
    RAISE EXCEPTION 'Nicht berechtigt.';
  END IF;
  SELECT * INTO v_src FROM public.finance_cashbook WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Buchung nicht gefunden.'; END IF;
  IF v_src.status <> 'aktiv' THEN RAISE EXCEPTION 'Buchung ist bereits %', v_src.status; END IF;

  INSERT INTO public.finance_cashbook(
    booking_date, document_number, booking_type,
    amount_net, vat_rate, amount_vat, amount_gross,
    payment_method, cost_center, description, reference,
    customer_id, supplier_id, status, reverses_id, user_id
  ) VALUES (
    (now() AT TIME ZONE 'Europe/Berlin')::date,
    v_src.document_number,
    CASE WHEN v_src.booking_type='einnahme' THEN 'ausgabe' ELSE 'einnahme' END,
    -v_src.amount_net, v_src.vat_rate, -v_src.amount_vat, -v_src.amount_gross,
    v_src.payment_method, v_src.cost_center,
    'STORNO ' || COALESCE(v_src.booking_number,'') || COALESCE(' – '||_reason,''),
    v_src.booking_number,
    v_src.customer_id, v_src.supplier_id, 'aktiv', v_src.id, auth.uid()
  ) RETURNING id INTO v_new_id;

  UPDATE public.finance_cashbook SET status='storniert', updated_at=now() WHERE id=_id;
  RETURN v_new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.cashbook_reverse(uuid, text) TO authenticated;
