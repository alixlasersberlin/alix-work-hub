-- Replace the broad supplier UPDATE policy with one that prevents changing sensitive fields
DROP POLICY IF EXISTS "suppliers can update own production orders" ON public.production_orders;

CREATE POLICY "suppliers can update own production orders"
ON public.production_orders
FOR UPDATE
TO authenticated
USING (
  is_supplier()
  AND supplier_id = current_supplier_id()
)
WITH CHECK (
  is_supplier()
  AND supplier_id = current_supplier_id()
  -- Lock immutable / sensitive fields to their existing values
  AND supplier_id            = (SELECT po.supplier_id            FROM public.production_orders po WHERE po.id = production_orders.id)
  AND order_id               = (SELECT po.order_id               FROM public.production_orders po WHERE po.id = production_orders.id)
  AND order_number           IS NOT DISTINCT FROM (SELECT po.order_number           FROM public.production_orders po WHERE po.id = production_orders.id)
  AND production_order_number IS NOT DISTINCT FROM (SELECT po.production_order_number FROM public.production_orders po WHERE po.id = production_orders.id)
  AND payment_status         IS NOT DISTINCT FROM (SELECT po.payment_status         FROM public.production_orders po WHERE po.id = production_orders.id)
  AND is_reclamation         IS NOT DISTINCT FROM (SELECT po.is_reclamation         FROM public.production_orders po WHERE po.id = production_orders.id)
  AND reclamation_reason     IS NOT DISTINCT FROM (SELECT po.reclamation_reason     FROM public.production_orders po WHERE po.id = production_orders.id)
  AND approval_status        IS NOT DISTINCT FROM (SELECT po.approval_status        FROM public.production_orders po WHERE po.id = production_orders.id)
  AND approved_by            IS NOT DISTINCT FROM (SELECT po.approved_by            FROM public.production_orders po WHERE po.id = production_orders.id)
  AND approved_at            IS NOT DISTINCT FROM (SELECT po.approved_at            FROM public.production_orders po WHERE po.id = production_orders.id)
  AND approval_note          IS NOT DISTINCT FROM (SELECT po.approval_note          FROM public.production_orders po WHERE po.id = production_orders.id)
  AND invoice_pdf_path       IS NOT DISTINCT FROM (SELECT po.invoice_pdf_path       FROM public.production_orders po WHERE po.id = production_orders.id)
  AND attachment_pdf_path    IS NOT DISTINCT FROM (SELECT po.attachment_pdf_path    FROM public.production_orders po WHERE po.id = production_orders.id)
  AND pdf_path               IS NOT DISTINCT FROM (SELECT po.pdf_path               FROM public.production_orders po WHERE po.id = production_orders.id)
  AND modellname             IS NOT DISTINCT FROM (SELECT po.modellname             FROM public.production_orders po WHERE po.id = production_orders.id)
  AND farbe                  IS NOT DISTINCT FROM (SELECT po.farbe                  FROM public.production_orders po WHERE po.id = production_orders.id)
  AND power_handstueck       IS NOT DISTINCT FROM (SELECT po.power_handstueck       FROM public.production_orders po WHERE po.id = production_orders.id)
  AND bearbeiter             IS NOT DISTINCT FROM (SELECT po.bearbeiter             FROM public.production_orders po WHERE po.id = production_orders.id)
  AND liefertermin           IS NOT DISTINCT FROM (SELECT po.liefertermin           FROM public.production_orders po WHERE po.id = production_orders.id)
  AND sonderwuensche         IS NOT DISTINCT FROM (SELECT po.sonderwuensche         FROM public.production_orders po WHERE po.id = production_orders.id)
);