-- Indizes zur Entlastung
CREATE INDEX IF NOT EXISTS idx_production_orders_is_reclamation ON public.production_orders(is_reclamation);
CREATE INDEX IF NOT EXISTS idx_production_orders_approval_status ON public.production_orders(approval_status, status);
CREATE INDEX IF NOT EXISTS idx_production_orders_order_id ON public.production_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_lager_devices_reserved_order_id ON public.lager_devices(reserved_order_id) WHERE reserved_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_deposit_ok ON public.orders(deposit_ok) WHERE deposit_ok = true;

-- Eine einzige Abfrage für alle Menü-Zähler
CREATE OR REPLACE FUNCTION public.sidebar_production_counts(p_at_only boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH po AS (
    SELECT p.id, p.order_id, p.is_reclamation, p.approval_status, p.status
    FROM public.production_orders p
    WHERE NOT p_at_only OR EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = p.order_id AND o.source_system = 'zoho_eu_2'
    )
  ),
  used AS (
    SELECT order_id AS oid FROM public.production_orders WHERE order_id IS NOT NULL
    UNION
    SELECT reserved_order_id FROM public.lager_devices WHERE reserved_order_id IS NOT NULL
  ),
  frei AS (
    SELECT count(*) AS c
    FROM public.orders o
    WHERE o.deposit_ok = true
      AND o.deposit_ok_by IS NOT NULL AND o.deposit_ok_by <> ''
      AND (NOT p_at_only OR o.source_system = 'zoho_eu_2')
      AND NOT EXISTS (SELECT 1 FROM used u WHERE u.oid = o.id)
  )
  SELECT jsonb_build_object(
    'all', (SELECT count(*) FROM po),
    'rekla', (SELECT count(*) FROM po WHERE is_reclamation),
    'factory', (SELECT count(*) FROM po WHERE is_reclamation IS NOT TRUE),
    'approved', (SELECT count(*) FROM po WHERE approval_status = 'approved' AND status IS DISTINCT FROM 'fertig'),
    'pending', (SELECT count(*) FROM po WHERE approval_status IS NULL OR approval_status = 'pending'),
    'fertig', (SELECT count(*) FROM po WHERE status = 'fertig'),
    'frei', (SELECT c FROM frei)
  );
$$;

REVOKE ALL ON FUNCTION public.sidebar_production_counts(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sidebar_production_counts(boolean) TO authenticated, service_role;

-- Audit-Protokoll nicht mehr über anonyme Data-API-Zugriffe scannbar
REVOKE SELECT ON public.audit_logs FROM anon;