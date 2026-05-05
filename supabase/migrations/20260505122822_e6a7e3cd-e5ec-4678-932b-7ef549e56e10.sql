
INSERT INTO storage.buckets (id, name, public) VALUES ('order-invoices', 'order-invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authorized roles can upload order invoices"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-invoices' AND public.can_manage_orders());

CREATE POLICY "admins can read order invoices"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-invoices' AND public.is_admin());

CREATE POLICY "admins can delete order invoices"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-invoices' AND public.is_admin());
