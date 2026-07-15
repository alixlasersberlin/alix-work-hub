
-- 1) Align catalog_item_descriptions & catalog_item_images read policies with catalog_items
DROP POLICY IF EXISTS cat_desc_read ON public.catalog_item_descriptions;
CREATE POLICY cat_desc_read ON public.catalog_item_descriptions
  FOR SELECT TO authenticated
  USING (
    has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text)
    OR has_role('Katalog Preise'::text) OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text)
    OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Geschäftsführung'::text)
    OR has_role('Order'::text) OR has_role('Lager'::text) OR has_role('Technik'::text)
    OR has_role('Tourenplanung'::text) OR has_role('Reparaturannahme'::text)
    OR has_role('Österreich'::text) OR has_role('QM'::text) OR can_access_finance()
  );

DROP POLICY IF EXISTS cat_img_read ON public.catalog_item_images;
CREATE POLICY cat_img_read ON public.catalog_item_images
  FOR SELECT TO authenticated
  USING (
    has_role('Super Admin'::text) OR has_role('Admin'::text) OR has_role('Katalog'::text)
    OR has_role('Katalog Preise'::text) OR has_role('Vertrieb'::text) OR has_role('Vertriebsleitung'::text)
    OR has_role('Marketing'::text) OR has_role('Service'::text) OR has_role('Geschäftsführung'::text)
    OR has_role('Order'::text) OR has_role('Lager'::text) OR has_role('Technik'::text)
    OR has_role('Tourenplanung'::text) OR has_role('Reparaturannahme'::text)
    OR has_role('Österreich'::text) OR has_role('QM'::text) OR can_access_finance()
  );

-- 2) Restrict media_package_* write/delete policies to authenticated (were on public role)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'media_package_services','media_package_studio_data','media_package_devices',
    'media_package_prices','media_package_treatments','media_package_team_members',
    'media_package_contact_data','media_package_branding','media_package_opening_hours'
  ];
  prefixes jsonb := '{
    "media_package_services":"mpsvc",
    "media_package_studio_data":"mpstud",
    "media_package_devices":"mpdev",
    "media_package_prices":"mpprices",
    "media_package_treatments":"mptreat",
    "media_package_team_members":"mpteam",
    "media_package_contact_data":"mpcontact",
    "media_package_branding":"mpbrand",
    "media_package_opening_hours":"mpoh"
  }'::jsonb;
  p text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    p := prefixes->>t;

    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', p, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (can_write_media_package(media_package_id))', p, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', p, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (can_write_media_package(media_package_id)) WITH CHECK (can_write_media_package(media_package_id))', p, t);

    EXECUTE format('DROP POLICY IF EXISTS %I_delete_sa ON public.%I', p, t);
    EXECUTE format('CREATE POLICY %I_delete_sa ON public.%I FOR DELETE TO authenticated USING (has_role(''Super Admin''::text))', p, t);
  END LOOP;
END $$;
