
-- 1) Rolle 'Order' anlegen
INSERT INTO public.roles (name, description)
VALUES ('Order', 'Operative Order-Rolle: Kunden, Artikel, Verkäufe, Prio-Listen, Bestellungen, Production (ohne Factory Invoice), Lagerbestand, Tourenplanung, Versand, Finanzierungen. Keine Löschrechte.')
ON CONFLICT (name) DO NOTHING;

-- 2) Zugriffsfunktionen erweitern: 'Order' bekommt operative Lese-/Schreibrechte wie Auftragsverwaltung,
--    Planung wie Tourenplanung und Lesezugriff auf Finanzierungen.

CREATE OR REPLACE FUNCTION public.can_access_orders()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or public.has_role('Auftragsverwaltung')
    or public.has_role('Tourenplanung')
    or public.has_role('Finance')
    or public.has_role('Order');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_orders()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or public.has_role('Auftragsverwaltung')
    or public.has_role('Order');
$$;

CREATE OR REPLACE FUNCTION public.can_access_planning()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or public.has_role('Tourenplanung')
    or public.has_role('Auftragsverwaltung')
    or public.has_role('Order');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_planning()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select
    public.is_admin()
    or public.has_role('Tourenplanung')
    or public.has_role('Order');
$$;

CREATE OR REPLACE FUNCTION public.can_access_financing()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Finance')
      OR public.has_role('Finanzierungen')
      OR public.has_role('Order');
$$;

-- 3) Production (ohne Factory Invoice): Order darf lesen + bearbeiten, NICHT löschen, NICHT Factory-Invoice-Funktionen
CREATE POLICY "order role read production orders"
ON public.production_orders FOR SELECT TO authenticated
USING (public.has_role('Order'));

CREATE POLICY "order role insert production orders"
ON public.production_orders FOR INSERT TO authenticated
WITH CHECK (public.has_role('Order'));

CREATE POLICY "order role update production orders"
ON public.production_orders FOR UPDATE TO authenticated
USING (public.has_role('Order'))
WITH CHECK (public.has_role('Order'));

CREATE POLICY "order role read production order items"
ON public.production_order_items FOR SELECT TO authenticated
USING (public.has_role('Order'));

CREATE POLICY "order role insert production order items"
ON public.production_order_items FOR INSERT TO authenticated
WITH CHECK (public.has_role('Order'));

CREATE POLICY "order role update production order items"
ON public.production_order_items FOR UPDATE TO authenticated
USING (public.has_role('Order'))
WITH CHECK (public.has_role('Order'));

-- 4) Lagerbestand: Order darf lesen + bearbeiten, nicht löschen
CREATE POLICY "order role read lager devices"
ON public.lager_devices FOR SELECT TO authenticated
USING (public.has_role('Order'));

CREATE POLICY "order role insert lager devices"
ON public.lager_devices FOR INSERT TO authenticated
WITH CHECK (public.has_role('Order'));

CREATE POLICY "order role update lager devices"
ON public.lager_devices FOR UPDATE TO authenticated
USING (public.has_role('Order'))
WITH CHECK (public.has_role('Order'));

-- 5) Lieferanten lesen (für Production-Auswahl)
CREATE POLICY "order role read suppliers"
ON public.suppliers FOR SELECT TO authenticated
USING (public.has_role('Order'));
