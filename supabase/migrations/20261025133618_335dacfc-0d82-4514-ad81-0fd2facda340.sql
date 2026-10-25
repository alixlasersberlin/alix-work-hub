DO $migration$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.hs_import_articles(text,jsonb)'::regprocedure);
 IF position('(h.shop_config->>''production_enabled'')' in definition)=0 THEN RAISE EXCEPTION 'Unexpected article gate'; END IF;
 definition:=replace(definition,'IF p_mode=''production'' AND NOT COALESCE((h.shop_config->>''production_enabled'')::boolean,false) THEN','IF p_mode=''production'' AND NOT COALESCE((h.shop_config->>''article_import_enabled'')::boolean,false) THEN');
 EXECUTE definition;
END;$migration$;
UPDATE public.integration_health SET shop_config=shop_config||jsonb_build_object('article_import_enabled',true,'production_enabled',false,'article_import_approved_at','2026-10-25T13:35:00Z'),updated_at=now() WHERE integration='hollywood-secret' AND tenant_id IN(SELECT id FROM public.tenants WHERE code='DE' AND is_active);
REVOKE ALL ON FUNCTION public.hs_import_articles(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hs_import_articles(text,jsonb) TO service_role;