CREATE FUNCTION public.ph2_versions(_channel text) RETURNS TABLE(product_id uuid,version text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT DISTINCT ON (l.product_id) l.product_id,l.payload->'signal'->>'version' FROM public.ph_sync_log l WHERE l.operation='ph2_signal' AND l.channel_code=_channel AND _channel IN ('de','com','dubai') ORDER BY l.product_id,(l.payload->'signal'->>'version') DESC;
$$;
REVOKE ALL ON FUNCTION public.ph2_versions(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ph2_versions(text) TO service_role;