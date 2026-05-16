ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note text;

-- Replace supplier read policy: only approved orders are visible to suppliers
DROP POLICY IF EXISTS "suppliers can read own production orders" ON public.production_orders;
CREATE POLICY "suppliers can read own production orders"
ON public.production_orders
FOR SELECT
TO authenticated
USING (
  is_supplier()
  AND supplier_id = current_supplier_id()
  AND approval_status = 'approved'
);

-- Same for production_order_items: suppliers only see items of approved orders
DROP POLICY IF EXISTS "suppliers can read own production order items" ON public.production_order_items;
CREATE POLICY "suppliers can read own production order items"
ON public.production_order_items
FOR SELECT
TO authenticated
USING (
  is_supplier()
  AND EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND po.supplier_id = current_supplier_id()
      AND po.approval_status = 'approved'
  )
);