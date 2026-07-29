-- Tax codes per region
CREATE TABLE IF NOT EXISTS public.finance_tax_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  rate numeric(6,3) NOT NULL,
  kind text NOT NULL DEFAULT 'output', -- output | input | reverse_charge | exempt | withholding
  account text,
  valid_from date NOT NULL DEFAULT '2000-01-01',
  valid_to date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (accounting_region, code, valid_from)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tax_codes TO authenticated;
GRANT ALL ON public.finance_tax_codes TO service_role;

ALTER TABLE public.finance_tax_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_codes_select_region" ON public.finance_tax_codes
  FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));

CREATE POLICY "tax_codes_write_admin" ON public.finance_tax_codes
  FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin') OR public.has_role('Buchhaltung Admin'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin') OR public.has_role('Buchhaltung Admin'));

CREATE TRIGGER trg_tax_codes_touch BEFORE UPDATE ON public.finance_tax_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed CH (gültig ab 2024-01-01)
INSERT INTO public.finance_tax_codes (accounting_region, code, name, rate, kind, account, valid_from) VALUES
  ('CH','MWST-N-81','MWST Normalsatz 8.1 %',8.100,'output','2200','2024-01-01'),
  ('CH','MWST-R-26','MWST Reduziert 2.6 %',2.600,'output','2201','2024-01-01'),
  ('CH','MWST-B-38','MWST Beherbergung 3.8 %',3.800,'output','2202','2024-01-01'),
  ('CH','MWST-0','MWST Steuerbefreit / Export 0 %',0.000,'exempt','2205','2024-01-01'),
  ('CH','BEZ-81','Bezugsteuer 8.1 %',8.100,'reverse_charge','1170','2024-01-01'),
  ('CH','VST-35','Verrechnungssteuer 35 %',35.000,'withholding','1176','2000-01-01')
ON CONFLICT DO NOTHING;

-- Seed EU/DE
INSERT INTO public.finance_tax_codes (accounting_region, code, name, rate, kind, account, valid_from) VALUES
  ('EU','USt-19','Umsatzsteuer 19 %',19.000,'output','3806','2007-01-01'),
  ('EU','USt-7','Umsatzsteuer ermäßigt 7 %',7.000,'output','3801','2007-01-01'),
  ('EU','USt-0','Steuerbefreit / innergemeinschaftlich 0 %',0.000,'exempt','8125','2000-01-01'),
  ('EU','VSt-19','Vorsteuer 19 %',19.000,'input','1406','2007-01-01'),
  ('EU','VSt-7','Vorsteuer ermäßigt 7 %',7.000,'input','1401','2007-01-01')
ON CONFLICT DO NOTHING;

-- Withholding tax (Verrechnungssteuer CH)
CREATE TABLE IF NOT EXISTS public.finance_withholding_tax (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL DEFAULT 'CH',
  tenant_id uuid,
  transaction_id uuid,
  booking_date date NOT NULL,
  gross_amount numeric(14,2) NOT NULL,
  tax_rate numeric(6,3) NOT NULL DEFAULT 35.000,
  tax_amount numeric(14,2) NOT NULL,
  net_amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CHF',
  counterparty text,
  reference text,
  refund_status text NOT NULL DEFAULT 'offen', -- offen | beantragt | erstattet | verjaehrt
  refund_requested_at date,
  refund_received_at date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_withholding_tax TO authenticated;
GRANT ALL ON public.finance_withholding_tax TO service_role;

ALTER TABLE public.finance_withholding_tax ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wht_select_region" ON public.finance_withholding_tax
  FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));

CREATE POLICY "wht_write_admin" ON public.finance_withholding_tax
  FOR ALL TO authenticated
  USING (public.has_role('Admin') OR public.has_role('Super Admin') OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung CH'))
  WITH CHECK (public.has_role('Admin') OR public.has_role('Super Admin') OR public.has_role('Buchhaltung Admin') OR public.has_role('Buchhaltung CH'));

CREATE TRIGGER trg_wht_touch BEFORE UPDATE ON public.finance_withholding_tax
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_wht_region_date ON public.finance_withholding_tax (accounting_region, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_wht_refund_status ON public.finance_withholding_tax (refund_status);