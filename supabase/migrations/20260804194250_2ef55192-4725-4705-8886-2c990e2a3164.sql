CREATE OR REPLACE FUNCTION public.sidebar_sales_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'routes_open', (SELECT count(*) FROM route_plans WHERE planning_status = 'offen'),
    'leads_open', (SELECT count(*) FROM sales_leads
       WHERE (assigned_user IS NULL OR lead_status IN ('Neu','Importiert - Angebot offen'))
         AND coalesce(lead_status,'') NOT IN ('Gewonnen','Verloren','Archiviert')),
    'offers_open', (SELECT count(*) FROM offers
       WHERE coalesce(status,'') NOT IN ('signed','order','unterschrieben','abgelehnt','storniert','expired','abgelaufen'))
  );
$$;

REVOKE ALL ON FUNCTION public.sidebar_sales_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sidebar_sales_counts() TO authenticated;