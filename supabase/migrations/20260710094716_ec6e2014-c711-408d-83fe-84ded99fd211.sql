DROP POLICY IF EXISTS finance_deposits_select_dashboard ON public.finance_deposits;

CREATE POLICY finance_deposits_select_dashboard
ON public.finance_deposits
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  AND NOT public.has_role('Österreich')
);