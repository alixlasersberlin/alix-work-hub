CREATE OR REPLACE FUNCTION public.sidebar_production_counts(p_at_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH po AS (
    SELECT p.id, p.order_id, p.is_reclamation, p.approval_status, p.status
    FROM public.production_orders p
    WHERE NOT p_at_only OR EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = p.order_id AND o.source_system = 'zoho_eu_2'
    )
  ),
  cand AS (
    SELECT o.id
    FROM public.orders o
    WHERE o.deposit_ok = true
      AND o.deposit_ok_by IS NOT NULL AND o.deposit_ok_by <> ''
      AND (NOT p_at_only OR o.source_system = 'zoho_eu_2')
      AND COALESCE(o.order_status,'') NOT IN ('Anwalt','Hold','anwalt','hold','geliefert','Geliefert','GELIEFERT','delivered','Delivered')
      AND NOT EXISTS (
        SELECT 1 FROM public.order_notes n
        WHERE n.order_id = o.id AND n.note_type = 'frei_bestellung_hidden'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.lager_devices d WHERE d.delivered_order_id = o.id
      )
  ),
  req AS (
    SELECT c.id,
      COALESCE((SELECT sum(COALESCE(i.quantity,1)) FROM public.order_items i WHERE i.order_id = c.id), 0) AS required,
      COALESCE((SELECT count(*) FROM public.production_orders p WHERE p.order_id = c.id), 0) AS po_count,
      COALESCE((SELECT count(*) FROM public.lager_devices d
                WHERE d.reserved_order_id = c.id
                  AND COALESCE(d.notes,'') NOT ILIKE '%leihger%'), 0) AS reserved
    FROM cand c
  ),
  frei AS (
    SELECT count(*) AS c
    FROM req
    WHERE po_count = 0
      AND NOT (required > 0 AND reserved >= required)
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
$function$;