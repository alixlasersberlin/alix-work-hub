
-- ============================================================
-- 1) Katalog-Referenztabellen: SELECT auf Rollen einschränken
-- ============================================================

-- catalog_categories
DROP POLICY IF EXISTS "cat_cat_read" ON public.catalog_categories;
CREATE POLICY "cat_cat_read"
  ON public.catalog_categories
  FOR SELECT
  USING (
    public.catalog_can_edit()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Katalog')
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Auftragsverwaltung')
  );

-- catalog_countries
DROP POLICY IF EXISTS "cat_country_read" ON public.catalog_countries;
CREATE POLICY "cat_country_read"
  ON public.catalog_countries
  FOR SELECT
  USING (
    public.catalog_can_edit()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Katalog')
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Auftragsverwaltung')
  );

-- catalog_currencies
DROP POLICY IF EXISTS "cat_cur_read" ON public.catalog_currencies;
CREATE POLICY "cat_cur_read"
  ON public.catalog_currencies
  FOR SELECT
  USING (
    public.catalog_can_manage_prices()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Katalog')
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Auftragsverwaltung')
  );

-- catalog_languages
DROP POLICY IF EXISTS "cat_lang_read" ON public.catalog_languages;
CREATE POLICY "cat_lang_read"
  ON public.catalog_languages
  FOR SELECT
  USING (
    public.catalog_can_edit()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Katalog')
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Auftragsverwaltung')
  );

-- catalog_bundles
DROP POLICY IF EXISTS "bundles_read_auth" ON public.catalog_bundles;
CREATE POLICY "bundles_read_auth"
  ON public.catalog_bundles
  FOR SELECT
  USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Katalog')
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Auftragsverwaltung')
  );

-- catalog_bundle_items
DROP POLICY IF EXISTS "bundle_items_read_auth" ON public.catalog_bundle_items;
CREATE POLICY "bundle_items_read_auth"
  ON public.catalog_bundle_items
  FOR SELECT
  USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Katalog')
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Auftragsverwaltung')
  );

-- catalog_bundle_price_tiers
DROP POLICY IF EXISTS "tiers_read_auth" ON public.catalog_bundle_price_tiers;
CREATE POLICY "tiers_read_auth"
  ON public.catalog_bundle_price_tiers
  FOR SELECT
  USING (
    public.catalog_can_manage_prices()
    OR public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Katalog')
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Auftragsverwaltung')
  );

-- catalog_pdf_templates
DROP POLICY IF EXISTS "cpt_read_auth" ON public.catalog_pdf_templates;
CREATE POLICY "cpt_read_auth"
  ON public.catalog_pdf_templates
  FOR SELECT
  USING (
    public.has_role('Super Admin')
    OR public.has_role('Admin')
    OR public.has_role('Katalog')
    OR public.has_role('Vertrieb')
    OR public.has_role('Vertriebsleitung')
    OR public.has_role('Order')
    OR public.has_role('SACHBEARBEITUNG')
    OR public.has_role('Auftragsverwaltung')
  );

-- ============================================================
-- 2) finance_records INSERT: kein NULL-Tenant-Bypass mehr
-- ============================================================
DROP POLICY IF EXISTS "authorized roles can insert finance records" ON public.finance_records;
CREATE POLICY "authorized roles can insert finance records"
  ON public.finance_records
  FOR INSERT
  WITH CHECK (
    public.can_access_finance()
    AND (
      public.has_role('Super Admin')
      OR (tenant_id IS NOT NULL AND public.has_tenant_access(tenant_id))
    )
  );
