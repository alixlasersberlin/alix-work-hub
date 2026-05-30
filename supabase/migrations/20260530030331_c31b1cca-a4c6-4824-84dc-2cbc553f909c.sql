DROP POLICY IF EXISTS "order_at_approval_select" ON public.order_at_approval;
CREATE POLICY "order_at_approval_select" ON public.order_at_approval
FOR SELECT TO authenticated
USING (public.has_role('Super Admin') OR public.has_role('Admin') OR public.has_role('Österreich'));