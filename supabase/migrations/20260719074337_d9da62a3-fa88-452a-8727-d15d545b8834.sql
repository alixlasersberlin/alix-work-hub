-- Track orders that were imported through the Zoho reconcile workflow
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS imported_via_reconcile_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_imported_via_reconcile_at
  ON public.orders (imported_via_reconcile_at DESC)
  WHERE imported_via_reconcile_at IS NOT NULL;

-- Backfill: mark orders that were originally missing and later imported
UPDATE public.orders o
SET imported_via_reconcile_at = COALESCE(om.imported_at, om.resolved_at, o.updated_at)
FROM public.orders_missing om
WHERE o.imported_via_reconcile_at IS NULL
  AND o.source_system = om.source_system
  AND (o.external_order_id = om.external_order_id OR o.order_number = om.order_number);