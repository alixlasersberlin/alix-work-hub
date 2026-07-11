
-- 1) esc_signatures: remove insecure anon INSERT policy
DROP POLICY IF EXISTS "esc_signatures public insert via token" ON public.esc_signatures;

-- 2) production_orders: block suppliers from changing approval fields
CREATE OR REPLACE FUNCTION public.prevent_supplier_approval_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce for supplier callers (not admins/order role/etc.)
  IF public.is_supplier() AND NOT public.is_admin() THEN
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Suppliers are not allowed to modify approval fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_supplier_approval_escalation ON public.production_orders;
CREATE TRIGGER trg_prevent_supplier_approval_escalation
BEFORE UPDATE ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_supplier_approval_escalation();

-- 3) customer_portal_document_downloads: explicit admin cleanup path
CREATE POLICY "cpdd_super_admin_update"
ON public.customer_portal_document_downloads
FOR UPDATE
TO authenticated
USING (public.has_role('Super Admin'::text))
WITH CHECK (public.has_role('Super Admin'::text));

CREATE POLICY "cpdd_super_admin_delete"
ON public.customer_portal_document_downloads
FOR DELETE
TO authenticated
USING (public.has_role('Super Admin'::text));
