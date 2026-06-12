
-- Fix 1: Restrict alix_sign_signatures SELECT to creators of the sign request or admins
DROP POLICY IF EXISTS "alix_sign_signatures_select" ON public.alix_sign_signatures;
DROP POLICY IF EXISTS "Internal users can read signatures" ON public.alix_sign_signatures;

CREATE POLICY "alix_sign_signatures_select_scoped"
ON public.alix_sign_signatures
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.alix_sign_requests r
    WHERE r.id = alix_sign_signatures.sign_request_id
      AND r.created_by = auth.uid()
  )
);

-- Fix 2: Scope AT-Österreich policies to authenticated role (not public/anon)
DROP POLICY IF EXISTS "at role can read ch orders" ON public.orders;
CREATE POLICY "at role can read ch orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_role('Österreich'));

DROP POLICY IF EXISTS "at role can read ch order items" ON public.order_items;
CREATE POLICY "at role can read ch order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.has_role('Österreich'));

DROP POLICY IF EXISTS "at role can read ch customers" ON public.customers;
CREATE POLICY "at role can read ch customers"
ON public.customers
FOR SELECT
TO authenticated
USING (public.has_role('Österreich'));
