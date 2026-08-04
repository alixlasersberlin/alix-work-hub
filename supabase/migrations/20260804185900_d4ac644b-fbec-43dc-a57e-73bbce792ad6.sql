-- audit_logs: Lese-Policy wertete is_admin()/has_role() pro Zeile aus (50k Zeilen => 100k Aufrufe).
-- InitPlan-Wrapping erzwingt eine einmalige Auswertung pro Abfrage.
DROP POLICY IF EXISTS "admin can read audit logs" ON public.audit_logs;
CREATE POLICY "admin can read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING ((SELECT public.is_admin()) OR (SELECT public.has_role('Read Only Audit'::text)));

-- lager_devices: Schreib-Policies ebenfalls pro Zeile ausgewertet.
DROP POLICY IF EXISTS "admins update lager devices" ON public.lager_devices;
CREATE POLICY "admins update lager devices"
ON public.lager_devices FOR UPDATE TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "order role update lager devices" ON public.lager_devices;
CREATE POLICY "order role update lager devices"
ON public.lager_devices FOR UPDATE TO authenticated
USING ((SELECT public.has_role('Order'::text)));

DROP POLICY IF EXISTS "sachbearbeitung update lager devices" ON public.lager_devices;
CREATE POLICY "sachbearbeitung update lager devices"
ON public.lager_devices FOR UPDATE TO authenticated
USING ((SELECT public.has_role('SACHBEARBEITUNG'::text)));

DROP POLICY IF EXISTS "only super admin can delete" ON public.lager_devices;
CREATE POLICY "only super admin can delete"
ON public.lager_devices FOR DELETE TO authenticated
USING ((SELECT public.has_role('Super Admin'::text)));

-- production_orders: identisches Muster.
DROP POLICY IF EXISTS "admins update production orders" ON public.production_orders;
CREATE POLICY "admins update production orders"
ON public.production_orders FOR UPDATE TO authenticated
USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "order role update production orders" ON public.production_orders;
CREATE POLICY "order role update production orders"
ON public.production_orders FOR UPDATE TO authenticated
USING ((SELECT public.has_role('Order'::text)));

DROP POLICY IF EXISTS "sachbearbeitung update production orders" ON public.production_orders;
CREATE POLICY "sachbearbeitung update production orders"
ON public.production_orders FOR UPDATE TO authenticated
USING ((SELECT public.has_role('SACHBEARBEITUNG'::text)));

DROP POLICY IF EXISTS "only super admin can delete" ON public.production_orders;
CREATE POLICY "only super admin can delete"
ON public.production_orders FOR DELETE TO authenticated
USING ((SELECT public.has_role('Super Admin'::text)));

DROP POLICY IF EXISTS "suppliers can update own production orders" ON public.production_orders;
CREATE POLICY "suppliers can update own production orders"
ON public.production_orders FOR UPDATE TO authenticated
USING ((SELECT public.is_supplier()) AND supplier_id = (SELECT public.current_supplier_id()));