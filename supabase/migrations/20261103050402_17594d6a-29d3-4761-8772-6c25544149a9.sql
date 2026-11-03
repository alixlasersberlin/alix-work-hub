CREATE INDEX IF NOT EXISTS idx_ml_offer_payload_lead ON public.offers ((payload->>'lead_id'));
CREATE INDEX IF NOT EXISTS idx_ml_order_offer_number ON public.orders ((raw_data->>'offer_number'));
CREATE INDEX IF NOT EXISTS idx_ml_order_source_offer ON public.orders ((raw_data->>'source_offer'));
CREATE INDEX IF NOT EXISTS idx_ml_order_source_offer_number ON public.orders ((raw_data->>'source_offer_number'));
CREATE OR REPLACE FUNCTION lead_private.ml_scoped_stats(_all boolean DEFAULT false, _tenant uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
 RETURN (
 WITH eligible AS MATERIALIZED (
 SELECT l.id,l.converted_offer_id FROM public.sales_leads l
 WHERE public.ml_can_access(l.id)
 AND (l.assigned_user=auth.uid() OR (_all AND public.is_admin()))
 AND (_tenant IS NULL OR l.tenant_id=_tenant OR (public.is_admin() AND l.tenant_id IS NULL))
 ), linked AS MATERIALIZED (
 SELECT o.id,o.offer_number,o.status FROM eligible l JOIN public.offers o ON o.id=l.converted_offer_id
 UNION
 SELECT o.id,o.offer_number,o.status FROM eligible l JOIN public.offers o ON o.payload->>'lead_id'=l.id::text
 ), linked_orders AS MATERIALIZED (
 SELECT o.id,o.total_amount FROM linked f JOIN public.orders o ON o.raw_data->>'offer_number'=f.offer_number
 UNION
 SELECT o.id,o.total_amount FROM linked f JOIN public.orders o ON o.raw_data->>'source_offer'=f.offer_number
 UNION
 SELECT o.id,o.total_amount FROM linked f JOIN public.orders o ON o.raw_data->>'source_offer_number'=f.offer_number
 )
 SELECT jsonb_build_object(
 'open_offers',(SELECT count(*) FROM linked WHERE coalesce(status,'draft') NOT IN ('order','signed','storniert','abgelehnt','expired','abgelaufen')),
 'order_value',(SELECT coalesce(sum(total_amount),0) FROM linked_orders),
 'orders',0)
 );
END $function$;