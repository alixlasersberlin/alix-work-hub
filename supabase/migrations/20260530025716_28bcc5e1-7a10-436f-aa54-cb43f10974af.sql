-- Freigabe AT: alle authentifizierten Nutzer dürfen lesen; Admin + Super Admin dürfen schreiben
DROP POLICY IF EXISTS "AT approval read" ON public.order_at_approval;
DROP POLICY IF EXISTS "AT approval insert" ON public.order_at_approval;
DROP POLICY IF EXISTS "AT approval update" ON public.order_at_approval;

CREATE POLICY "AT approval read"
  ON public.order_at_approval FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "AT approval insert"
  ON public.order_at_approval FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "AT approval update"
  ON public.order_at_approval FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());