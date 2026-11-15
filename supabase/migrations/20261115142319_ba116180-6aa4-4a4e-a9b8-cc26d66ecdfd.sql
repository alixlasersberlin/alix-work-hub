CREATE POLICY ph_products_read_angebotsersteller ON public.ph_products FOR SELECT TO authenticated
USING ((SELECT public.has_role('Angebotsersteller')));