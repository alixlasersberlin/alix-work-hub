CREATE OR REPLACE FUNCTION public.ac_dashboard_kpis(p_tenant_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH d AS (SELECT now() - interval '7 days' AS t0)
  SELECT jsonb_build_object(
    'messages',   (SELECT COUNT(*) FROM ac_messages m, d WHERE m.created_at >= d.t0 AND (p_tenant_id IS NULL OR m.tenant_id = p_tenant_id)),
    'convs',      (SELECT COUNT(*) FROM ac_conversations c, d WHERE c.created_at >= d.t0 AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)),
    'contacts',   (SELECT COUNT(*) FROM ac_contacts k WHERE p_tenant_id IS NULL OR k.tenant_id = p_tenant_id),
    'events',     (SELECT COUNT(*) FROM ac_analytics_events e, d WHERE e.created_at >= d.t0),
    'campaigns',  (SELECT COUNT(*) FROM ac_campaigns),
    'openInbox',  (SELECT COUNT(*) FROM ac_conversations c WHERE c.status IN ('open','pending') AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id))
  )
  WHERE auth.uid() IS NOT NULL;
$function$;