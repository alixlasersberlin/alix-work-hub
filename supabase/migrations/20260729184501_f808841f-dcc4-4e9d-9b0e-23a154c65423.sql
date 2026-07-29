-- Phase 3: QR-Rechnung, CH Direct Debit (LSV+/BDD), CAMT.054

-- ============ finance_qr_invoices ============
CREATE TABLE public.finance_qr_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT,
  customer_id UUID,
  order_id UUID,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CHF',
  qr_iban TEXT NOT NULL,
  creditor_name TEXT NOT NULL,
  creditor_street TEXT,
  creditor_house_no TEXT,
  creditor_postal_code TEXT,
  creditor_city TEXT,
  creditor_country TEXT DEFAULT 'CH',
  debtor_name TEXT,
  debtor_street TEXT,
  debtor_house_no TEXT,
  debtor_postal_code TEXT,
  debtor_city TEXT,
  debtor_country TEXT DEFAULT 'CH',
  reference_type TEXT NOT NULL DEFAULT 'QRR' CHECK (reference_type IN ('QRR','SCOR','NON')),
  reference TEXT,
  unstructured_message TEXT,
  bill_info TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf','erstellt','versendet','bezahlt','storniert')),
  paid_at TIMESTAMPTZ,
  matched_entry_id UUID,
  pdf_path TEXT,
  accounting_region public.accounting_region NOT NULL DEFAULT 'CH',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qr_inv_status ON public.finance_qr_invoices(status);
CREATE INDEX idx_qr_inv_reference ON public.finance_qr_invoices(reference);
CREATE INDEX idx_qr_inv_customer ON public.finance_qr_invoices(customer_id);
GRANT SELECT, INSERT, UPDATE ON public.finance_qr_invoices TO authenticated;
GRANT ALL ON public.finance_qr_invoices TO service_role;
ALTER TABLE public.finance_qr_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY qr_inv_ro ON public.finance_qr_invoices FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));
CREATE POLICY qr_inv_ins ON public.finance_qr_invoices FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_region_access(accounting_region));
CREATE POLICY qr_inv_upd ON public.finance_qr_invoices FOR UPDATE TO authenticated
  USING (public.has_finance_region_access(accounting_region))
  WITH CHECK (public.has_finance_region_access(accounting_region));
CREATE POLICY qr_inv_del ON public.finance_qr_invoices FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ============ finance_ch_dd_mandates ============
CREATE TABLE public.finance_ch_dd_mandates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID,
  scheme TEXT NOT NULL DEFAULT 'LSV+' CHECK (scheme IN ('LSV+','BDD')),
  mandate_reference TEXT NOT NULL,
  iban TEXT NOT NULL,
  bic TEXT,
  account_holder TEXT NOT NULL,
  signed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','pausiert','widerrufen')),
  creditor_id TEXT,
  notes TEXT,
  accounting_region public.accounting_region NOT NULL DEFAULT 'CH',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mandate_reference)
);
GRANT SELECT, INSERT, UPDATE ON public.finance_ch_dd_mandates TO authenticated;
GRANT ALL ON public.finance_ch_dd_mandates TO service_role;
ALTER TABLE public.finance_ch_dd_mandates ENABLE ROW LEVEL SECURITY;
CREATE POLICY ch_dd_m_ro ON public.finance_ch_dd_mandates FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));
CREATE POLICY ch_dd_m_ins ON public.finance_ch_dd_mandates FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_region_access(accounting_region));
CREATE POLICY ch_dd_m_upd ON public.finance_ch_dd_mandates FOR UPDATE TO authenticated
  USING (public.has_finance_region_access(accounting_region))
  WITH CHECK (public.has_finance_region_access(accounting_region));
CREATE POLICY ch_dd_m_del ON public.finance_ch_dd_mandates FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ============ finance_ch_dd_runs ============
CREATE TABLE public.finance_ch_dd_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_number TEXT NOT NULL UNIQUE,
  scheme TEXT NOT NULL DEFAULT 'LSV+' CHECK (scheme IN ('LSV+','BDD')),
  collection_date DATE NOT NULL,
  creditor_id TEXT,
  creditor_name TEXT NOT NULL,
  creditor_iban TEXT NOT NULL,
  creditor_bic TEXT,
  total_amount NUMERIC(18,2) DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf','exportiert','eingereicht','verbucht','storniert')),
  exported_at TIMESTAMPTZ,
  accounting_region public.accounting_region NOT NULL DEFAULT 'CH',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.finance_ch_dd_runs TO authenticated;
GRANT ALL ON public.finance_ch_dd_runs TO service_role;
ALTER TABLE public.finance_ch_dd_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ch_dd_r_ro ON public.finance_ch_dd_runs FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));
CREATE POLICY ch_dd_r_ins ON public.finance_ch_dd_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_region_access(accounting_region));
CREATE POLICY ch_dd_r_upd ON public.finance_ch_dd_runs FOR UPDATE TO authenticated
  USING (public.has_finance_region_access(accounting_region))
  WITH CHECK (public.has_finance_region_access(accounting_region));
CREATE POLICY ch_dd_r_del ON public.finance_ch_dd_runs FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ============ finance_ch_dd_run_items ============
CREATE TABLE public.finance_ch_dd_run_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.finance_ch_dd_runs(id) ON DELETE CASCADE,
  mandate_id UUID NOT NULL REFERENCES public.finance_ch_dd_mandates(id),
  customer_id UUID,
  amount NUMERIC(18,2) NOT NULL,
  reference TEXT,
  remittance_info TEXT,
  end_to_end_id TEXT,
  status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','exportiert','verbucht','storniert','ruecklastschrift')),
  accounting_region public.accounting_region NOT NULL DEFAULT 'CH',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ch_dd_items_run ON public.finance_ch_dd_run_items(run_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_ch_dd_run_items TO authenticated;
GRANT ALL ON public.finance_ch_dd_run_items TO service_role;
ALTER TABLE public.finance_ch_dd_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ch_dd_i_all ON public.finance_ch_dd_run_items FOR ALL TO authenticated
  USING (public.has_finance_region_access(accounting_region))
  WITH CHECK (public.has_finance_region_access(accounting_region));

-- ============ finance_camt054_notifications ============
CREATE TABLE public.finance_camt054_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_hash TEXT NOT NULL UNIQUE,
  message_id TEXT,
  account_iban TEXT,
  currency TEXT DEFAULT 'CHF',
  booking_date DATE,
  total_amount NUMERIC(18,2) DEFAULT 0,
  entry_count INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'importiert' CHECK (status IN ('importiert','verarbeitet','fehler')),
  raw_xml TEXT,
  accounting_region public.accounting_region NOT NULL DEFAULT 'CH',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.finance_camt054_notifications TO authenticated;
GRANT ALL ON public.finance_camt054_notifications TO service_role;
ALTER TABLE public.finance_camt054_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY camt054_n_ro ON public.finance_camt054_notifications FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));
CREATE POLICY camt054_n_ins ON public.finance_camt054_notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_region_access(accounting_region));
CREATE POLICY camt054_n_upd ON public.finance_camt054_notifications FOR UPDATE TO authenticated
  USING (public.has_finance_region_access(accounting_region))
  WITH CHECK (public.has_finance_region_access(accounting_region));
CREATE POLICY camt054_n_del ON public.finance_camt054_notifications FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ============ finance_camt054_entries ============
CREATE TABLE public.finance_camt054_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.finance_camt054_notifications(id) ON DELETE CASCADE,
  booking_date DATE,
  value_date DATE,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT DEFAULT 'CHF',
  reference TEXT,
  end_to_end_id TEXT,
  debtor_name TEXT,
  debtor_iban TEXT,
  remittance_info TEXT,
  matched_qr_invoice_id UUID REFERENCES public.finance_qr_invoices(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'offen' CHECK (match_status IN ('offen','zugeordnet','manuell','ignoriert')),
  accounting_region public.accounting_region NOT NULL DEFAULT 'CH',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_camt054_e_ref ON public.finance_camt054_entries(reference);
CREATE INDEX idx_camt054_e_notif ON public.finance_camt054_entries(notification_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_camt054_entries TO authenticated;
GRANT ALL ON public.finance_camt054_entries TO service_role;
ALTER TABLE public.finance_camt054_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY camt054_e_all ON public.finance_camt054_entries FOR ALL TO authenticated
  USING (public.has_finance_region_access(accounting_region))
  WITH CHECK (public.has_finance_region_access(accounting_region));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_qr_inv_upd BEFORE UPDATE ON public.finance_qr_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ch_dd_m_upd BEFORE UPDATE ON public.finance_ch_dd_mandates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ch_dd_r_upd BEFORE UPDATE ON public.finance_ch_dd_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ch_dd_i_upd BEFORE UPDATE ON public.finance_ch_dd_run_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_camt054_n_upd BEFORE UPDATE ON public.finance_camt054_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_camt054_e_upd BEFORE UPDATE ON public.finance_camt054_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CH DD run number sequence ============
CREATE OR REPLACE FUNCTION public.assign_ch_dd_run_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr TEXT := to_char(now(), 'YYYY');
  next_n INT;
BEGIN
  IF NEW.run_number IS NOT NULL AND NEW.run_number <> '' THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(run_number, '^CHDD-\d{4}-', ''), '')::int), 0) + 1
    INTO next_n FROM public.finance_ch_dd_runs WHERE run_number LIKE 'CHDD-' || yr || '-%';
  NEW.run_number := 'CHDD-' || yr || '-' || lpad(next_n::text, 4, '0');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_assign_ch_dd_run_number BEFORE INSERT ON public.finance_ch_dd_runs
  FOR EACH ROW EXECUTE FUNCTION public.assign_ch_dd_run_number();

-- ============ QR reference validator (Modulo-10 recursive) ============
CREATE OR REPLACE FUNCTION public.qr_reference_check_digit(_body TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  tbl INT[] := ARRAY[0,9,4,6,8,2,7,1,3,5];
  carry INT := 0;
  i INT;
  d INT;
BEGIN
  FOR i IN 1..length(_body) LOOP
    d := substr(_body, i, 1)::int;
    carry := tbl[((carry + d) % 10) + 1];
  END LOOP;
  RETURN ((10 - carry) % 10)::text;
END; $$;

-- ============ Auto-match CAMT.054 entries against QR invoices ============
CREATE OR REPLACE FUNCTION public.camt054_match_entry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  match_id UUID;
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN RETURN NEW; END IF;
  SELECT id INTO match_id FROM public.finance_qr_invoices
   WHERE reference = NEW.reference
     AND status IN ('erstellt','versendet')
     AND abs(amount - NEW.amount) < 0.01
   LIMIT 1;
  IF match_id IS NOT NULL THEN
    NEW.matched_qr_invoice_id := match_id;
    NEW.match_status := 'zugeordnet';
    UPDATE public.finance_qr_invoices
       SET status = 'bezahlt', paid_at = now(), matched_entry_id = NEW.id
     WHERE id = match_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_camt054_match BEFORE INSERT ON public.finance_camt054_entries
  FOR EACH ROW EXECUTE FUNCTION public.camt054_match_entry();