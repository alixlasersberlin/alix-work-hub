CREATE OR REPLACE FUNCTION lead_private.ml_order_status(_lead_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.ml_can_access(_lead_id) THEN RAISE EXCEPTION 'Lead nicht zugänglich' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'order_date',o.order_date,'total_amount',o.total_amount,'order_status',o.order_status,'source_system',o.source_system,'payment_status',o.finance_payment_status,'paid_amount',o.finance_paid_amount,'delivery_status',o.order_status) ORDER BY o.order_date DESC NULLS LAST) FROM public.orders o WHERE
  EXISTS(SELECT 1 FROM public.sales_leads l WHERE l.id=_lead_id AND l.converted_customer_id IS NOT NULL AND l.converted_customer_id=o.customer_id)
  OR EXISTS(SELECT 1 FROM public.sales_leads l JOIN public.offers f ON (f.id=l.converted_offer_id OR f.payload->>'lead_id'=l.id::text) WHERE l.id=_lead_id AND (
   (f.customer_id IS NOT NULL AND f.customer_id=o.customer_id)
   OR o.raw_data->>'offer_number'=f.offer_number OR o.raw_data->>'source_offer'=f.offer_number OR o.raw_data->>'source_offer_number'=f.offer_number))),'[]'::jsonb); END $$;
REVOKE ALL ON FUNCTION lead_private.ml_order_status(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION lead_private.ml_order_status(uuid) TO authenticated;