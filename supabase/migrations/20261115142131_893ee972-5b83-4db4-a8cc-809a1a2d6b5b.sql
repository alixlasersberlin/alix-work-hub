INSERT INTO public.roles (name, description)
SELECT 'Angebotsersteller', 'Darf ausschließlich Angebote erstellen und nur eigene Angebote sehen'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Angebotsersteller');

-- Angebote anlegen (nur als eigener Ersteller)
CREATE POLICY offers_insert_angebotsersteller ON public.offers FOR INSERT TO authenticated
WITH CHECK ((SELECT public.has_role('Angebotsersteller')) AND created_by = (SELECT auth.uid()));

-- Neue Kunden aus dem Angebot anlegen und nur eigene bearbeiten
CREATE POLICY customers_insert_angebotsersteller ON public.customers FOR INSERT TO authenticated
WITH CHECK ((SELECT public.has_role('Angebotsersteller')) AND created_by = (SELECT auth.uid()));
CREATE POLICY customers_update_angebotsersteller ON public.customers FOR UPDATE TO authenticated
USING ((SELECT public.has_role('Angebotsersteller')) AND created_by = (SELECT auth.uid()))
WITH CHECK ((SELECT public.has_role('Angebotsersteller')) AND created_by = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.customers_set_created_by()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_customers_set_created_by ON public.customers;
CREATE TRIGGER trg_customers_set_created_by BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.customers_set_created_by();

-- Artikel für Angebotspositionen lesen
CREATE POLICY catalog_items_read_angebotsersteller ON public.catalog_items FOR SELECT TO authenticated
USING ((SELECT public.has_role('Angebotsersteller')));
CREATE POLICY zoho_items_read_angebotsersteller ON public.zoho_items FOR SELECT TO authenticated
USING ((SELECT public.has_role('Angebotsersteller')));
CREATE POLICY catalog_item_snapshots_read_angebotsersteller ON public.catalog_item_snapshots FOR SELECT TO authenticated
USING ((SELECT public.has_role('Angebotsersteller')));

-- L. Scheidler und Sanae: alle bisherigen Rollen entziehen, nur Angebotsersteller
DELETE FROM public.user_roles
WHERE user_id IN ('45820f2c-6d6c-4067-9816-cc6dc4500db4','7212fdcc-3bc3-4092-85cc-f96c6821c21e');
INSERT INTO public.user_roles (user_id, role_id)
SELECT u, r.id FROM unnest(ARRAY['45820f2c-6d6c-4067-9816-cc6dc4500db4','7212fdcc-3bc3-4092-85cc-f96c6821c21e']::uuid[]) u
CROSS JOIN public.roles r WHERE r.name = 'Angebotsersteller';