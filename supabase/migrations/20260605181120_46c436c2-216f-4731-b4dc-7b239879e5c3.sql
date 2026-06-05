
-- 1. Restrict qm_attachments SELECT to QM
DROP POLICY IF EXISTS "all authenticated read attachments" ON public.qm_attachments;
CREATE POLICY "qm read attachments" ON public.qm_attachments
  FOR SELECT TO authenticated
  USING (public.can_access_qm());

-- 2. Restrict storage bug-capa-attachments SELECT to QM
DROP POLICY IF EXISTS "all authenticated read bug-capa attachments" ON storage.objects;
CREATE POLICY "qm read bug-capa attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bug-capa-attachments' AND public.can_access_qm());

-- 3. Restrict supplier update policy to authenticated role
DROP POLICY IF EXISTS "suppliers can update own production orders" ON public.production_orders;
CREATE POLICY "suppliers can update own production orders" ON public.production_orders
  FOR UPDATE TO authenticated
  USING (public.is_supplier() AND supplier_id = public.current_supplier_id())
  WITH CHECK (public.is_supplier() AND supplier_id = public.current_supplier_id());

-- 4. Revoke EXECUTE on trigger function from anon/authenticated/public
REVOKE EXECUTE ON FUNCTION public.enforce_supplier_production_order_immutability() FROM PUBLIC, anon, authenticated;
