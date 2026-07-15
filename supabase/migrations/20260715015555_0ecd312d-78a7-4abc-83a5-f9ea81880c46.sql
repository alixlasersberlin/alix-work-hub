
-- 1) Narrow mail/communication access: entferne 'Read Only' und 'Read Only Audit'
CREATE OR REPLACE FUNCTION public.can_access_mail()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin()
    OR public.has_role('Geschäftsführung')
    OR public.has_role('Marketing')
    OR public.has_role('Finance')
    OR public.has_role('Technik')
    OR public.has_role('Kundenservice')
    OR public.has_role('Vertrieb')
    OR public.has_role('Reparaturannahme')
    OR public.has_role('Tourenplanung')
    OR public.has_role('Bestellwesen')
    OR public.has_role('Order')
    OR public.has_role('Österreich')
    OR public.has_role('SACHBEARBEITUNG');
$function$;

-- 2) Katalog-Stammdaten: SELECT nur noch für eingeloggte Nutzer (statt USING(true))
DROP POLICY IF EXISTS "bundle_items_read_all_auth" ON public.catalog_bundle_items;
CREATE POLICY "bundle_items_read_auth" ON public.catalog_bundle_items
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tiers_read_all_auth" ON public.catalog_bundle_price_tiers;
CREATE POLICY "tiers_read_auth" ON public.catalog_bundle_price_tiers
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "bundles_read_all_auth" ON public.catalog_bundles;
CREATE POLICY "bundles_read_auth" ON public.catalog_bundles
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cat_cat_read" ON public.catalog_categories;
CREATE POLICY "cat_cat_read" ON public.catalog_categories
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cat_country_read" ON public.catalog_countries;
CREATE POLICY "cat_country_read" ON public.catalog_countries
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cat_cur_read" ON public.catalog_currencies;
CREATE POLICY "cat_cur_read" ON public.catalog_currencies
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cat_desc_read" ON public.catalog_item_descriptions;
CREATE POLICY "cat_desc_read" ON public.catalog_item_descriptions
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cat_img_read" ON public.catalog_item_images;
CREATE POLICY "cat_img_read" ON public.catalog_item_images
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cat_lang_read" ON public.catalog_languages;
CREATE POLICY "cat_lang_read" ON public.catalog_languages
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cpt_read_all" ON public.catalog_pdf_templates;
CREATE POLICY "cpt_read_auth" ON public.catalog_pdf_templates
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- 3) system_maintenance: für anon nur die Banner-Spalten sichtbar, nicht updated_by
REVOKE SELECT ON public.system_maintenance FROM anon;
GRANT SELECT (id, enabled, message, updated_at) ON public.system_maintenance TO anon;
