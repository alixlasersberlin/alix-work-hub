
-- Drop recursive supplier update policy
DROP POLICY IF EXISTS "suppliers can update own production orders" ON public.production_orders;

-- Recreate a simple update policy for suppliers (without self-referencing subqueries)
CREATE POLICY "suppliers can update own production orders"
ON public.production_orders
FOR UPDATE
USING (is_supplier() AND supplier_id = current_supplier_id())
WITH CHECK (is_supplier() AND supplier_id = current_supplier_id());

-- Enforce immutability of protected fields via trigger (only for suppliers)
CREATE OR REPLACE FUNCTION public.enforce_supplier_production_order_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only applies when the acting user is a supplier and NOT admin
  IF public.is_supplier() AND NOT public.is_admin() THEN
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
       OR NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.order_number IS DISTINCT FROM OLD.order_number
       OR NEW.production_order_number IS DISTINCT FROM OLD.production_order_number
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.is_reclamation IS DISTINCT FROM OLD.is_reclamation
       OR NEW.reclamation_reason IS DISTINCT FROM OLD.reclamation_reason
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approval_note IS DISTINCT FROM OLD.approval_note
       OR NEW.invoice_pdf_path IS DISTINCT FROM OLD.invoice_pdf_path
       OR NEW.attachment_pdf_path IS DISTINCT FROM OLD.attachment_pdf_path
       OR NEW.pdf_path IS DISTINCT FROM OLD.pdf_path
       OR NEW.modellname IS DISTINCT FROM OLD.modellname
       OR NEW.farbe IS DISTINCT FROM OLD.farbe
       OR NEW.power_handstueck IS DISTINCT FROM OLD.power_handstueck
       OR NEW.bearbeiter IS DISTINCT FROM OLD.bearbeiter
       OR NEW.liefertermin IS DISTINCT FROM OLD.liefertermin
       OR NEW.sonderwuensche IS DISTINCT FROM OLD.sonderwuensche
       OR NEW.anmerkungen IS DISTINCT FROM OLD.anmerkungen
       OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    THEN
      RAISE EXCEPTION 'Suppliers are not allowed to modify protected production order fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_supplier_po_immutability ON public.production_orders;
CREATE TRIGGER trg_enforce_supplier_po_immutability
BEFORE UPDATE ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_supplier_production_order_immutability();
