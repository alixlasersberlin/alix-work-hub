CREATE POLICY sales_leads_admin_read_gate ON public.sales_leads AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY sales_lead_history_admin_read_gate ON public.sales_lead_history AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY sales_followups_admin_read_gate ON public.sales_followups AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE OR REPLACE FUNCTION public.sidebar_sales_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public
AS $function$
SELECT jsonb_build_object(
 'routes_open', (SELECT count(*) FROM public.route_plans WHERE planning_status = 'offen'),
 'leads_open', CASE WHEN public.is_admin() THEN (SELECT count(*) FROM public.sales_leads
 WHERE (assigned_user IS NULL OR lead_status IN ('Neu','Importiert - Angebot offen'))
 AND coalesce(lead_status,'') NOT IN ('Gewonnen','Verloren','Archiviert')) ELSE NULL END,
 'offers_open', (SELECT count(*) FROM public.offers WHERE coalesce(status,'') NOT IN ('signed','order','unterschrieben','abgelehnt','storniert','expired','abgelaufen'))
);
$function$;