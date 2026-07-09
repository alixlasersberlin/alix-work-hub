-- Tighten storage RLS: enforce tenant/order scoping via joins to underlying tables (whose RLS already scopes by tenant/source_system).

-- =========================================================
-- finance-documents  → finance_documents.file_path
-- =========================================================
DROP POLICY IF EXISTS "Finance can read finance-documents" ON storage.objects;
DROP POLICY IF EXISTS "Finance can insert finance-documents" ON storage.objects;
DROP POLICY IF EXISTS "Finance can update finance-documents" ON storage.objects;
DROP POLICY IF EXISTS "Finance can delete finance-documents" ON storage.objects;

CREATE POLICY "Finance can read finance-documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'finance-documents'
  AND (public.is_admin() OR public.has_role('Finance') OR public.has_role('Geschäftsführung'))
  AND EXISTS (
    SELECT 1 FROM public.finance_documents fd WHERE fd.file_path = storage.objects.name
  )
);

CREATE POLICY "Finance can insert finance-documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'finance-documents'
  AND (public.is_admin() OR public.has_role('Finance'))
);

CREATE POLICY "Finance can update finance-documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'finance-documents'
  AND (public.is_admin() OR public.has_role('Finance'))
  AND EXISTS (SELECT 1 FROM public.finance_documents fd WHERE fd.file_path = storage.objects.name)
);

CREATE POLICY "Finance can delete finance-documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'finance-documents'
  AND public.has_role('Super Admin')
);

-- =========================================================
-- finance-deposits  → path pattern "<deposit_id>/<file>"
-- =========================================================
DROP POLICY IF EXISTS "Finance can read finance-deposits" ON storage.objects;
DROP POLICY IF EXISTS "Finance can insert finance-deposits" ON storage.objects;
DROP POLICY IF EXISTS "Finance can update finance-deposits" ON storage.objects;
DROP POLICY IF EXISTS "Finance can delete finance-deposits" ON storage.objects;

CREATE POLICY "Finance can read finance-deposits"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'finance-deposits'
  AND public.can_view_finance_module()
  AND EXISTS (
    SELECT 1 FROM public.finance_deposits fd
    WHERE fd.id::text = split_part(storage.objects.name, '/', 1)
  )
);

CREATE POLICY "Finance can insert finance-deposits"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'finance-deposits'
  AND public.can_access_finance_module()
  AND EXISTS (
    SELECT 1 FROM public.finance_deposits fd
    WHERE fd.id::text = split_part(storage.objects.name, '/', 1)
  )
);

CREATE POLICY "Finance can update finance-deposits"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'finance-deposits'
  AND public.can_access_finance_module()
  AND EXISTS (
    SELECT 1 FROM public.finance_deposits fd
    WHERE fd.id::text = split_part(storage.objects.name, '/', 1)
  )
);

CREATE POLICY "Finance can delete finance-deposits"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'finance-deposits'
  AND public.has_role('Super Admin')
);

-- =========================================================
-- finance-cashbook  → finance_cashbook.attachment_path
-- =========================================================
DROP POLICY IF EXISTS "Finance can read finance-cashbook" ON storage.objects;
DROP POLICY IF EXISTS "Finance can insert finance-cashbook" ON storage.objects;
DROP POLICY IF EXISTS "Finance can update finance-cashbook" ON storage.objects;
DROP POLICY IF EXISTS "Finance can delete finance-cashbook" ON storage.objects;

CREATE POLICY "Finance can read finance-cashbook"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'finance-cashbook'
  AND public.can_view_finance_module()
  AND EXISTS (
    SELECT 1 FROM public.finance_cashbook fc WHERE fc.attachment_path = storage.objects.name
  )
);

CREATE POLICY "Finance can insert finance-cashbook"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'finance-cashbook'
  AND public.can_access_finance_module()
);

CREATE POLICY "Finance can update finance-cashbook"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'finance-cashbook'
  AND public.can_access_finance_module()
  AND EXISTS (
    SELECT 1 FROM public.finance_cashbook fc WHERE fc.attachment_path = storage.objects.name
  )
);

CREATE POLICY "Finance can delete finance-cashbook"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'finance-cashbook'
  AND public.has_role('Super Admin')
);

-- =========================================================
-- bank-offers  → path pattern "<order_id>/<file>", scope via orders RLS
-- =========================================================
DROP POLICY IF EXISTS "bank-offers read" ON storage.objects;
DROP POLICY IF EXISTS "bank-offers insert" ON storage.objects;
DROP POLICY IF EXISTS "bank-offers update" ON storage.objects;
DROP POLICY IF EXISTS "bank-offers delete" ON storage.objects;

CREATE POLICY "bank-offers read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bank-offers'
  AND (public.can_access_finance() OR public.can_access_orders())
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(storage.objects.name, '/', 1)
  )
);

CREATE POLICY "bank-offers insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bank-offers'
  AND public.can_access_finance()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(storage.objects.name, '/', 1)
  )
);

CREATE POLICY "bank-offers update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'bank-offers'
  AND public.can_access_finance()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(storage.objects.name, '/', 1)
  )
);

CREATE POLICY "bank-offers delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bank-offers'
  AND public.can_access_finance()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = split_part(storage.objects.name, '/', 1)
  )
);

-- =========================================================
-- order-invoices  → order_documents.file_path joined to orders (source_system/tenant via orders RLS)
-- =========================================================
DROP POLICY IF EXISTS "Order managers can read order invoices" ON storage.objects;
DROP POLICY IF EXISTS "Order managers can update order invoices" ON storage.objects;
DROP POLICY IF EXISTS "Order managers can delete order invoices" ON storage.objects;
DROP POLICY IF EXISTS "admins can read order invoices" ON storage.objects;
DROP POLICY IF EXISTS "admins can delete order invoices" ON storage.objects;

CREATE POLICY "Order managers can read order invoices"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'order-invoices'
  AND public.can_manage_orders()
  AND EXISTS (
    SELECT 1 FROM public.order_documents od
    JOIN public.orders o ON o.id = od.order_id
    WHERE od.file_path = storage.objects.name
  )
);

CREATE POLICY "Order managers can update order invoices"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'order-invoices'
  AND public.can_manage_orders()
  AND EXISTS (
    SELECT 1 FROM public.order_documents od
    JOIN public.orders o ON o.id = od.order_id
    WHERE od.file_path = storage.objects.name
  )
);

CREATE POLICY "Order managers can delete order invoices"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'order-invoices'
  AND public.can_manage_orders()
  AND EXISTS (
    SELECT 1 FROM public.order_documents od
    JOIN public.orders o ON o.id = od.order_id
    WHERE od.file_path = storage.objects.name
  )
);

CREATE POLICY "admins can read order invoices"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-invoices' AND public.is_admin());

CREATE POLICY "admins can delete order invoices"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-invoices' AND public.is_admin());
