
-- 1) Helper functions: SACHBEARBEITUNG hinzufügen
CREATE OR REPLACE FUNCTION public.can_access_orders()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or public.has_role('Auftragsverwaltung')
    or public.has_role('Tourenplanung')
    or public.has_role('Finance')
    or public.has_role('Order')
    or public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_orders()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or public.has_role('Auftragsverwaltung')
    or public.has_role('Order')
    or public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_access_planning()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or public.has_role('Tourenplanung')
    or public.has_role('Auftragsverwaltung')
    or public.has_role('Order')
    or public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_planning()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or public.has_role('Tourenplanung')
    or public.has_role('Order')
    or public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_access_repair()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Order')
      OR public.has_role('Technik')
      OR public.has_role('Finance')
      OR public.has_role('Tourenplanung')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Österreich')
      OR public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_repair()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Order')
      OR public.has_role('Technik')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Österreich')
      OR public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_access_warranty()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Technik')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Finance')
      OR public.has_role('Tourenplanung')
      OR public.has_role('Kundenservice')
      OR public.has_role('Österreich')
      OR public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_access_maintenance()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Service')
      OR public.has_role('Serviceleitung')
      OR public.has_role('Technik')
      OR public.has_role('Kundenservice')
      OR public.has_role('Reparaturannahme')
      OR public.has_role('Finance')
      OR public.has_role('Tourenplanung')
      OR public.has_role('Vertrieb')
      OR public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_access_tickets()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Kundenservice')
    OR public.has_role('Technik')
    OR public.has_role('Finance')
    OR public.has_role('Tourenplanung')
    OR public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_tickets()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Kundenservice')
    OR public.has_role('Technik')
    OR public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_access_mail()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
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
    OR public.has_role('Read Only')
    OR public.has_role('Read Only Audit')
    OR public.has_role('Österreich')
    OR public.has_role('SACHBEARBEITUNG');
$$;

CREATE OR REPLACE FUNCTION public.can_access_import_logs()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or public.has_role('Auftragsverwaltung')
    or public.has_role('Read Only Audit')
    or public.has_role('SACHBEARBEITUNG');
$$;

-- 2) Zusätzliche Policies für SACHBEARBEITUNG (analog Order/Bestellwesen, ohne DELETE)

-- Tickets (lesen)
CREATE POLICY "tickets_select_sachbearbeitung"
  ON public.tickets FOR SELECT TO authenticated
  USING (has_role('SACHBEARBEITUNG'));

-- Reviews (lesen)
DROP POLICY IF EXISTS "reviews_select_internal_staff" ON public.reviews;
CREATE POLICY "reviews_select_internal_staff"
  ON public.reviews FOR SELECT TO authenticated
  USING (is_admin() OR has_role('Auftragsverwaltung') OR has_role('SACHBEARBEITUNG'));

-- Lagerverwaltung (lesen/schreiben wie Order)
CREATE POLICY "sachbearbeitung read lager devices"
  ON public.lager_devices FOR SELECT TO authenticated
  USING (has_role('SACHBEARBEITUNG'));
CREATE POLICY "sachbearbeitung insert lager devices"
  ON public.lager_devices FOR INSERT TO authenticated
  WITH CHECK (has_role('SACHBEARBEITUNG'));
CREATE POLICY "sachbearbeitung update lager devices"
  ON public.lager_devices FOR UPDATE TO authenticated
  USING (has_role('SACHBEARBEITUNG'));

-- Bestellwesen: production_orders + items (lesen/schreiben wie Order)
CREATE POLICY "sachbearbeitung read production orders"
  ON public.production_orders FOR SELECT TO authenticated
  USING (has_role('SACHBEARBEITUNG'));
CREATE POLICY "sachbearbeitung insert production orders"
  ON public.production_orders FOR INSERT TO authenticated
  WITH CHECK (has_role('SACHBEARBEITUNG'));
CREATE POLICY "sachbearbeitung update production orders"
  ON public.production_orders FOR UPDATE TO authenticated
  USING (has_role('SACHBEARBEITUNG'));

CREATE POLICY "sachbearbeitung read production order items"
  ON public.production_order_items FOR SELECT TO authenticated
  USING (has_role('SACHBEARBEITUNG'));
CREATE POLICY "sachbearbeitung insert production order items"
  ON public.production_order_items FOR INSERT TO authenticated
  WITH CHECK (has_role('SACHBEARBEITUNG'));
CREATE POLICY "sachbearbeitung update production order items"
  ON public.production_order_items FOR UPDATE TO authenticated
  USING (has_role('SACHBEARBEITUNG'));
