
-- Fix 1: finance_approvals — kein Selbst-Freigeben (inkl. 4-Augen)
DROP POLICY IF EXISTS approvals_update ON public.finance_approvals;
CREATE POLICY approvals_update ON public.finance_approvals
  FOR UPDATE
  USING (can_access_finance() OR has_role('Geschäftsführung'::text))
  WITH CHECK (
    (can_access_finance() OR has_role('Geschäftsführung'::text))
    AND (approved_by IS NULL OR approved_by <> requested_by)
    AND (second_approver_id IS NULL OR (
      second_approver_id <> requested_by
      AND (approved_by IS NULL OR second_approver_id <> approved_by)
    ))
  );

-- Fix 2: finance_payment_approvals — kein Selbst-Freigeben
DROP POLICY IF EXISTS fpa_update ON public.finance_payment_approvals;
CREATE POLICY fpa_update ON public.finance_payment_approvals
  FOR UPDATE
  USING (is_admin() OR can_access_finance() OR has_role('Geschäftsführung'::text))
  WITH CHECK (
    (is_admin() OR can_access_finance() OR has_role('Geschäftsführung'::text))
    AND (approved_by IS NULL OR approved_by <> requested_by)
  );

-- Fix 3: Storage — Factory Invoice nur invoices/-Ordner im 'production-orders'-Bucket
DROP POLICY IF EXISTS "factory invoice can read production-orders objects" ON storage.objects;
CREATE POLICY "factory invoice can read production-orders objects"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'production-orders'
    AND can_upload_factory_invoice()
    AND (storage.foldername(name))[1] = 'invoices'
  );
