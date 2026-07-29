
-- ============================================================
-- FINANCE CH · PHASE 1 · FOUNDATION
-- ============================================================

-- Helper: Region-Zugriff (nutzt auth.uid() intern via has_role)
CREATE OR REPLACE FUNCTION public.has_finance_region_access(_region public.accounting_region)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Finance')
    OR public.has_role('Buchhaltung Admin')
    OR (_region = 'EU' AND public.has_role('Buchhaltung EU'))
    OR (_region = 'CH' AND public.has_role('Buchhaltung CH'));
$$;
COMMENT ON FUNCTION public.has_finance_region_access IS
  'Region-Zugriffsprüfung für Finance-Daten (EU/CH). Nutzt auth.uid() intern.';

CREATE OR REPLACE FUNCTION public.finance_can_write()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Finance')
    OR public.has_role('Buchhaltung Admin')
    OR public.has_role('Buchhaltung EU')
    OR public.has_role('Buchhaltung CH');
$$;

-- ---- Kostenstellen ----
CREATE TABLE public.finance_cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (accounting_region, code)
);
CREATE INDEX idx_finance_cost_centers_region ON public.finance_cost_centers(accounting_region, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cost_centers TO authenticated;
GRANT ALL ON public.finance_cost_centers TO service_role;
ALTER TABLE public.finance_cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_select" ON public.finance_cost_centers FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));
CREATE POLICY "cc_insert" ON public.finance_cost_centers FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_region_access(accounting_region) AND public.finance_can_write());
CREATE POLICY "cc_update" ON public.finance_cost_centers FOR UPDATE TO authenticated
  USING (public.has_finance_region_access(accounting_region) AND public.finance_can_write());
CREATE POLICY "cc_delete" ON public.finance_cost_centers FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ---- Kostenträger ----
CREATE TABLE public.finance_cost_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (accounting_region, code)
);
CREATE INDEX idx_finance_cost_units_region ON public.finance_cost_units(accounting_region, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cost_units TO authenticated;
GRANT ALL ON public.finance_cost_units TO service_role;
ALTER TABLE public.finance_cost_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cu_select" ON public.finance_cost_units FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));
CREATE POLICY "cu_insert" ON public.finance_cost_units FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_region_access(accounting_region) AND public.finance_can_write());
CREATE POLICY "cu_update" ON public.finance_cost_units FOR UPDATE TO authenticated
  USING (public.has_finance_region_access(accounting_region) AND public.finance_can_write());
CREATE POLICY "cu_delete" ON public.finance_cost_units FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ---- Kontenrahmen ----
CREATE TABLE public.finance_chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL,
  account_number text NOT NULL,
  name text NOT NULL,
  account_class text NOT NULL CHECK (account_class IN ('AKTIV','PASSIV','AUFWAND','ERTRAG','ABSCHLUSS')),
  account_type text,
  default_tax_code text,
  default_vat_rate numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  chart_framework text NOT NULL DEFAULT 'CUSTOM',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (accounting_region, account_number)
);
CREATE INDEX idx_finance_coa_region ON public.finance_chart_of_accounts(accounting_region, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_chart_of_accounts TO authenticated;
GRANT ALL ON public.finance_chart_of_accounts TO service_role;
ALTER TABLE public.finance_chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coa_select" ON public.finance_chart_of_accounts FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));
CREATE POLICY "coa_insert" ON public.finance_chart_of_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_region_access(accounting_region) AND (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin')));
CREATE POLICY "coa_update" ON public.finance_chart_of_accounts FOR UPDATE TO authenticated
  USING (public.has_finance_region_access(accounting_region) AND (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin')));
CREATE POLICY "coa_delete" ON public.finance_chart_of_accounts FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- ---- Perioden ----
CREATE TABLE public.finance_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL,
  fiscal_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','soft_closed','hard_locked')),
  closed_at timestamptz,
  closed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (accounting_region, fiscal_year, period_month)
);
CREATE INDEX idx_finance_periods_lookup ON public.finance_periods(accounting_region, fiscal_year, period_month, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_periods TO authenticated;
GRANT ALL ON public.finance_periods TO service_role;
ALTER TABLE public.finance_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "per_select" ON public.finance_periods FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));
CREATE POLICY "per_insert" ON public.finance_periods FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_region_access(accounting_region) AND (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin')));
CREATE POLICY "per_update" ON public.finance_periods FOR UPDATE TO authenticated
  USING (public.has_finance_region_access(accounting_region) AND (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin')));
CREATE POLICY "per_delete" ON public.finance_periods FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

CREATE OR REPLACE FUNCTION public.finance_period_is_postable(
  _region public.accounting_region, _dt date
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'open' FROM public.finance_periods
      WHERE accounting_region = _region
        AND fiscal_year  = EXTRACT(YEAR FROM _dt)::int
        AND period_month = EXTRACT(MONTH FROM _dt)::int LIMIT 1),
    true
  );
$$;
COMMENT ON FUNCTION public.finance_period_is_postable IS
  'hard_locked = NEIN. Kein Override, auch nicht für Super Admin.';

-- ---- Saldovortrag ----
CREATE TABLE public.finance_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL,
  fiscal_year int NOT NULL,
  account_number text NOT NULL,
  debit numeric(18,2) NOT NULL DEFAULT 0,
  credit numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (accounting_region, fiscal_year, account_number)
);
CREATE INDEX idx_finance_ob_lookup ON public.finance_opening_balances(accounting_region, fiscal_year);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_opening_balances TO authenticated;
GRANT ALL ON public.finance_opening_balances TO service_role;
ALTER TABLE public.finance_opening_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ob_select" ON public.finance_opening_balances FOR SELECT TO authenticated
  USING (public.has_finance_region_access(accounting_region));
CREATE POLICY "ob_insert" ON public.finance_opening_balances FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_region_access(accounting_region) AND (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin')));
CREATE POLICY "ob_update" ON public.finance_opening_balances FOR UPDATE TO authenticated
  USING (public.has_finance_region_access(accounting_region) AND (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Buchhaltung Admin')));
CREATE POLICY "ob_delete" ON public.finance_opening_balances FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'));

-- updated_at Trigger
CREATE TRIGGER trg_cc_touch  BEFORE UPDATE ON public.finance_cost_centers        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cu_touch  BEFORE UPDATE ON public.finance_cost_units          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_coa_touch BEFORE UPDATE ON public.finance_chart_of_accounts   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_per_touch BEFORE UPDATE ON public.finance_periods             FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ob_touch  BEFORE UPDATE ON public.finance_opening_balances    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SEED · KMU-Kontenrahmen CH (Käfer/veb.ch)
-- ============================================================
INSERT INTO public.finance_chart_of_accounts
  (accounting_region, account_number, name, account_class, account_type, default_vat_rate, chart_framework) VALUES
('CH','1000','Kasse','AKTIV','Flüssige Mittel',NULL,'KMU_CH'),
('CH','1010','Postkonto','AKTIV','Flüssige Mittel',NULL,'KMU_CH'),
('CH','1020','Bankkonto CHF','AKTIV','Flüssige Mittel',NULL,'KMU_CH'),
('CH','1021','Bankkonto EUR','AKTIV','Flüssige Mittel',NULL,'KMU_CH'),
('CH','1060','Wertschriften','AKTIV','Wertschriften',NULL,'KMU_CH'),
('CH','1100','Forderungen aus Lieferungen und Leistungen (Debitoren)','AKTIV','Forderungen',NULL,'KMU_CH'),
('CH','1109','Wertberichtigung Debitoren (Delkredere)','AKTIV','Forderungen',NULL,'KMU_CH'),
('CH','1170','Vorsteuer MwSt auf Material/Dienstleistungen','AKTIV','MwSt',NULL,'KMU_CH'),
('CH','1171','Vorsteuer MwSt auf Investitionen/Betriebsaufwand','AKTIV','MwSt',NULL,'KMU_CH'),
('CH','1176','Verrechnungssteuer (Rückforderung)','AKTIV','Steuern',NULL,'KMU_CH'),
('CH','1200','Handelswaren','AKTIV','Warenlager',NULL,'KMU_CH'),
('CH','1210','Rohmaterial','AKTIV','Warenlager',NULL,'KMU_CH'),
('CH','1260','Fertige Erzeugnisse','AKTIV','Warenlager',NULL,'KMU_CH'),
('CH','1270','Angefangene Arbeiten','AKTIV','Warenlager',NULL,'KMU_CH'),
('CH','1300','Aktive Rechnungsabgrenzung','AKTIV','ARA',NULL,'KMU_CH'),
('CH','1400','Wertschriften Anlagevermögen','AKTIV','Finanzanlagen',NULL,'KMU_CH'),
('CH','1440','Darlehen (Aktiv)','AKTIV','Finanzanlagen',NULL,'KMU_CH'),
('CH','1500','Maschinen und Apparate','AKTIV','Sachanlagen',NULL,'KMU_CH'),
('CH','1510','Mobiliar und Einrichtungen','AKTIV','Sachanlagen',NULL,'KMU_CH'),
('CH','1520','Büromaschinen, IT, Kommunikationstechnik','AKTIV','Sachanlagen',NULL,'KMU_CH'),
('CH','1530','Fahrzeuge','AKTIV','Sachanlagen',NULL,'KMU_CH'),
('CH','1540','Werkzeuge und Geräte','AKTIV','Sachanlagen',NULL,'KMU_CH'),
('CH','1600','Immobilien Geschäftsliegenschaften','AKTIV','Sachanlagen',NULL,'KMU_CH'),
('CH','1700','Patente, Know-how, Lizenzen','AKTIV','Immaterielle Werte',NULL,'KMU_CH'),
('CH','1770','Goodwill','AKTIV','Immaterielle Werte',NULL,'KMU_CH'),
('CH','2000','Verbindlichkeiten aus Lieferungen und Leistungen (Kreditoren)','PASSIV','Kreditoren',NULL,'KMU_CH'),
('CH','2100','Kurzfristige verzinsliche Verbindlichkeiten','PASSIV','Finanzverbindlichkeiten',NULL,'KMU_CH'),
('CH','2140','Kontokorrent Aktionäre','PASSIV','Finanzverbindlichkeiten',NULL,'KMU_CH'),
('CH','2170','Erhaltene Anzahlungen','PASSIV','Anzahlungen',NULL,'KMU_CH'),
('CH','2200','Geschuldete MwSt (Umsatzsteuer)','PASSIV','MwSt',NULL,'KMU_CH'),
('CH','2201','MwSt-Abrechnungskonto','PASSIV','MwSt',NULL,'KMU_CH'),
('CH','2206','Geschuldete Verrechnungssteuer 35%','PASSIV','Steuern',NULL,'KMU_CH'),
('CH','2210','Sonstige kurzfristige Verbindlichkeiten','PASSIV','Sonstige',NULL,'KMU_CH'),
('CH','2270','Verbindlichkeiten Sozialversicherungen','PASSIV','Sozialversicherungen',NULL,'KMU_CH'),
('CH','2279','Direkte Steuern (Bund/Kanton/Gemeinde)','PASSIV','Steuern',NULL,'KMU_CH'),
('CH','2300','Passive Rechnungsabgrenzung','PASSIV','PRA',NULL,'KMU_CH'),
('CH','2330','Kurzfristige Rückstellungen','PASSIV','Rückstellungen',NULL,'KMU_CH'),
('CH','2400','Langfristige verzinsliche Verbindlichkeiten (Bankdarlehen)','PASSIV','Finanzverbindlichkeiten',NULL,'KMU_CH'),
('CH','2450','Darlehen (Passiv)','PASSIV','Finanzverbindlichkeiten',NULL,'KMU_CH'),
('CH','2500','Hypotheken','PASSIV','Finanzverbindlichkeiten',NULL,'KMU_CH'),
('CH','2600','Langfristige Rückstellungen','PASSIV','Rückstellungen',NULL,'KMU_CH'),
('CH','2800','Grundkapital / Aktienkapital / Stammkapital','PASSIV','Eigenkapital',NULL,'KMU_CH'),
('CH','2900','Gesetzliche Kapitalreserve','PASSIV','Eigenkapital',NULL,'KMU_CH'),
('CH','2950','Gesetzliche Gewinnreserve','PASSIV','Eigenkapital',NULL,'KMU_CH'),
('CH','2960','Freiwillige Gewinnreserven','PASSIV','Eigenkapital',NULL,'KMU_CH'),
('CH','2970','Bilanzgewinn / Bilanzverlust','PASSIV','Eigenkapital',NULL,'KMU_CH'),
('CH','2979','Jahresgewinn / Jahresverlust','PASSIV','Eigenkapital',NULL,'KMU_CH'),
('CH','3000','Produktionserlöse','ERTRAG','Umsatz',8.1,'KMU_CH'),
('CH','3200','Handelserlöse','ERTRAG','Umsatz',8.1,'KMU_CH'),
('CH','3400','Dienstleistungserlöse','ERTRAG','Umsatz',8.1,'KMU_CH'),
('CH','3600','Übrige Erlöse aus Lieferungen und Leistungen','ERTRAG','Umsatz',8.1,'KMU_CH'),
('CH','3700','Eigenleistungen','ERTRAG','Umsatz',NULL,'KMU_CH'),
('CH','3710','Eigenverbrauch','ERTRAG','Umsatz',8.1,'KMU_CH'),
('CH','3800','Erlösminderungen (Skonti, Rabatte)','ERTRAG','Umsatz',8.1,'KMU_CH'),
('CH','3805','Verluste aus Debitorenforderungen','ERTRAG','Umsatz',NULL,'KMU_CH'),
('CH','3900','Bestandesänderungen fertige/unfertige Erzeugnisse','ERTRAG','Umsatz',NULL,'KMU_CH'),
('CH','4000','Materialaufwand Handelswaren','AUFWAND','Materialaufwand',8.1,'KMU_CH'),
('CH','4200','Handelswarenaufwand','AUFWAND','Materialaufwand',8.1,'KMU_CH'),
('CH','4400','Aufwand für bezogene Dienstleistungen','AUFWAND','Materialaufwand',8.1,'KMU_CH'),
('CH','4900','Bestandsänderungen','AUFWAND','Materialaufwand',NULL,'KMU_CH'),
('CH','5000','Lohnaufwand Produktion','AUFWAND','Personalaufwand',NULL,'KMU_CH'),
('CH','5200','Lohnaufwand Handel/Dienstleistungen','AUFWAND','Personalaufwand',NULL,'KMU_CH'),
('CH','5700','Sozialversicherungsaufwand','AUFWAND','Personalaufwand',NULL,'KMU_CH'),
('CH','5800','Übriger Personalaufwand','AUFWAND','Personalaufwand',NULL,'KMU_CH'),
('CH','5900','Leistungen Dritter (Temporäre)','AUFWAND','Personalaufwand',8.1,'KMU_CH'),
('CH','6000','Raumaufwand (Miete)','AUFWAND','Betriebsaufwand',NULL,'KMU_CH'),
('CH','6100','Unterhalt, Reparaturen, Ersatz Anlagen','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6105','Leasingaufwand mobile Sachanlagen','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6200','Fahrzeug- und Transportaufwand','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6260','Fahrzeugleasing','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6300','Sachversicherungen, Abgaben, Gebühren','AUFWAND','Betriebsaufwand',NULL,'KMU_CH'),
('CH','6400','Energie- und Entsorgungsaufwand','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6500','Verwaltungsaufwand','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6510','Büromaterial, Drucksachen, Fachliteratur','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6513','Telefon, Internet, Porti','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6520','Beiträge, Spenden','AUFWAND','Betriebsaufwand',NULL,'KMU_CH'),
('CH','6530','Buchführungs-, Beratungs-, Revisionsaufwand','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6570','Informatikaufwand','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6600','Werbeaufwand','AUFWAND','Betriebsaufwand',8.1,'KMU_CH'),
('CH','6700','Sonstiger Betriebsaufwand','AUFWAND','Betriebsaufwand',NULL,'KMU_CH'),
('CH','6800','Abschreibungen','AUFWAND','Abschreibungen',NULL,'KMU_CH'),
('CH','6900','Finanzaufwand','AUFWAND','Finanzaufwand',NULL,'KMU_CH'),
('CH','6940','Bankspesen','AUFWAND','Finanzaufwand',NULL,'KMU_CH'),
('CH','6950','Kursverluste','AUFWAND','Finanzaufwand',NULL,'KMU_CH'),
('CH','6990','Finanzertrag','ERTRAG','Finanzertrag',NULL,'KMU_CH'),
('CH','7000','Betriebsfremder Aufwand','AUFWAND','Betriebsfremd',NULL,'KMU_CH'),
('CH','7010','Betriebsfremder Ertrag','ERTRAG','Betriebsfremd',NULL,'KMU_CH'),
('CH','8000','Ausserordentlicher Aufwand','AUFWAND','Ausserordentlich',NULL,'KMU_CH'),
('CH','8010','Ausserordentlicher Ertrag','ERTRAG','Ausserordentlich',NULL,'KMU_CH'),
('CH','8900','Direkte Steuern','AUFWAND','Steuern',NULL,'KMU_CH'),
('CH','9000','Erfolgsrechnung (Sammelkonto)','ABSCHLUSS','Abschluss',NULL,'KMU_CH'),
('CH','9200','Jahresgewinn / Jahresverlust','ABSCHLUSS','Abschluss',NULL,'KMU_CH')
ON CONFLICT (accounting_region, account_number) DO NOTHING;
