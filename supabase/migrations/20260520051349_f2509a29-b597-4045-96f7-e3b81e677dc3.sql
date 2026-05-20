CREATE POLICY "factory invoice can read suppliers"
ON public.suppliers
FOR SELECT
TO authenticated
USING (public.can_upload_factory_invoice());