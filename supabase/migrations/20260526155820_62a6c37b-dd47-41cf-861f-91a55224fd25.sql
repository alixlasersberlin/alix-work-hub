
-- 1. Neue Rolle einfügen (falls noch nicht vorhanden)
INSERT INTO public.roles (name, description)
VALUES ('Finanzierungen', 'Zugriff ausschließlich auf den Finanzierungen-Bereich (Bank-Anfragen, Leasing)')
ON CONFLICT (name) DO NOTHING;

-- 2. Helper-Funktion für Finanzierungen-Zugriff
CREATE OR REPLACE FUNCTION public.can_access_financing()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
      OR public.has_role('Finance')
      OR public.has_role('Finanzierungen');
$$;

-- 3. bank_financing_requests RLS aktualisieren (Finanzierungen-Rolle einschließen)
DROP POLICY IF EXISTS "finance can read bank requests" ON public.bank_financing_requests;
DROP POLICY IF EXISTS "finance can insert bank requests" ON public.bank_financing_requests;
DROP POLICY IF EXISTS "finance can update bank requests" ON public.bank_financing_requests;
DROP POLICY IF EXISTS "finance and admins delete bank requests" ON public.bank_financing_requests;

CREATE POLICY "financing can read bank requests"
  ON public.bank_financing_requests FOR SELECT TO authenticated
  USING (public.can_access_financing() OR public.can_access_orders());

CREATE POLICY "financing can insert bank requests"
  ON public.bank_financing_requests FOR INSERT TO authenticated
  WITH CHECK (public.can_access_financing());

CREATE POLICY "financing can update bank requests"
  ON public.bank_financing_requests FOR UPDATE TO authenticated
  USING (public.can_access_financing())
  WITH CHECK (public.can_access_financing());

CREATE POLICY "financing and admins delete bank requests"
  ON public.bank_financing_requests FOR DELETE TO authenticated
  USING (public.is_admin() OR public.can_access_financing());

-- 4. Lesezugriff für Finanzierungen-Rolle auf orders, customers, order_items
CREATE POLICY "financing role can read orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_role('Finanzierungen'));

CREATE POLICY "financing role can read customers"
  ON public.customers FOR SELECT TO authenticated
  USING (public.has_role('Finanzierungen'));

CREATE POLICY "financing role can read order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role('Finanzierungen'));
