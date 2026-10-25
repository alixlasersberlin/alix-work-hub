CREATE UNIQUE INDEX IF NOT EXISTS hs_article_identity ON public.integration_logs(source,event,external_id) WHERE source IN ('hollywood-secret:sandbox','hollywood-secret:production') AND event='article';
CREATE OR REPLACE FUNCTION public.hs_import_articles(p_mode text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE h public.integration_health; a jsonb; rec public.integration_logs; ext text; src text; aid uuid; result jsonb; results jsonb:='[]'::jsonb; created integer:=0; repeated integer:=0; skipped integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_mode IS NULL OR p_mode NOT IN ('sandbox','production') THEN RAISE EXCEPTION 'HS_FORBIDDEN'; END IF;
 IF p_payload->>'shop_id' IS DISTINCT FROM 'hollywood-secret' THEN RAISE EXCEPTION 'HS_FORBIDDEN'; END IF;
 SELECT * INTO h FROM public.integration_health WHERE integration='hollywood-secret' FOR SHARE;
 IF h.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=h.tenant_id AND code='DE' AND is_active) THEN RAISE EXCEPTION 'HS_SETUP_REQUIRED'; END IF;
 IF p_mode='production' AND NOT COALESCE((h.shop_config->>'production_enabled')::boolean,false) THEN RAISE EXCEPTION 'HS_PRODUCTION_DISABLED'; END IF;
 IF p_mode='sandbox' AND NOT COALESCE((h.shop_config->>'test_enabled')::boolean,false) THEN RAISE EXCEPTION 'HS_TEST_DISABLED'; END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('shop_id','articles')) OR jsonb_typeof(p_payload->'articles') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
 IF jsonb_array_length(p_payload->'articles')<1 OR jsonb_array_length(p_payload->'articles')>100 THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
 IF (SELECT count(DISTINCT value->>'external_article_id') FROM jsonb_array_elements(p_payload->'articles'))<>jsonb_array_length(p_payload->'articles') OR (SELECT count(DISTINCT value->>'sku') FROM jsonb_array_elements(p_payload->'articles'))<>jsonb_array_length(p_payload->'articles') THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
 src:='hollywood-secret:'||p_mode;
 PERFORM pg_advisory_xact_lock(hashtextextended(src||':articles',0));
 FOR a IN SELECT value FROM jsonb_array_elements(p_payload->'articles') LOOP
   IF jsonb_typeof(a) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(a) k WHERE k NOT IN ('external_article_id','sku','name','manufacturer','brand','model')) THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   ext:=a->>'external_article_id';
   IF ext IS NULL OR length(ext) NOT BETWEEN 1 AND 128 OR ext!~'^[A-Za-z0-9_.-]+$' OR jsonb_typeof(a->'external_article_id')<>'string' OR jsonb_typeof(a->'sku') IS DISTINCT FROM 'string' OR length(a->>'sku') NOT BETWEEN 1 AND 100 OR (a->>'sku')!~'^[A-Za-z0-9_.-]+$' OR jsonb_typeof(a->'name') IS DISTINCT FROM 'string' OR length(trim(a->>'name')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_each(a) f WHERE f.key IN ('manufacturer','brand','model') AND (jsonb_typeof(f.value)<>'string' OR length(f.value#>>'{}')>200)) THEN RAISE EXCEPTION 'HS_INVALID_INPUT'; END IF;
   SELECT * INTO rec FROM public.integration_logs WHERE source=src AND event='article' AND external_id=ext;
   IF rec.id IS NOT NULL THEN
     IF rec.payload->'article' IS DISTINCT FROM a THEN RAISE EXCEPTION 'HS_ARTICLE_CONFLICT'; END IF;
     result:=(rec.payload->'response')||jsonb_build_object('replayed',true); repeated:=repeated+1;
   ELSE
     aid:=NULL;
     IF p_mode='sandbox' THEN aid:=gen_random_uuid();
     ELSE
       INSERT INTO public.catalog_items(sku,name,manufacturer,brand,model,status,source_system,source_ref,default_currency)
       VALUES(a->>'sku',trim(a->>'name'),a->>'manufacturer',a->>'brand',a->>'model','entwurf','zoho_eu_1','hollywood-secret:'||ext,'EUR') ON CONFLICT DO NOTHING RETURNING id INTO aid;
     END IF;
     result:=jsonb_build_object('external_article_id',ext,'sku',a->>'sku','article_id',aid,'status',CASE WHEN aid IS NULL THEN 'skipped_existing' WHEN p_mode='sandbox' THEN 'test_created' ELSE 'draft_created' END,'replayed',false);
     INSERT INTO public.integration_logs(source,event,external_id,status,tenant_id,message,payload) VALUES(src,'article',ext,CASE WHEN p_mode='sandbox' THEN 'test' ELSE 'ok' END,h.tenant_id,CASE WHEN aid IS NULL THEN 'Bestehender Artikel unverändert' ELSE 'Artikel ohne Preisfreigabe übernommen' END,jsonb_build_object('article',a,'response',result));
     IF aid IS NULL THEN skipped:=skipped+1; ELSE created:=created+1; END IF;
   END IF;
   results:=results||jsonb_build_array(result);
 END LOOP;
 RETURN jsonb_build_object('shop_id','hollywood-secret','mode',p_mode,'created',created,'replayed',repeated,'skipped',skipped,'articles',results,'prices_imported',false,'production_enabled',COALESCE((h.shop_config->>'production_enabled')::boolean,false));
END;$fn$;
REVOKE ALL ON FUNCTION public.hs_import_articles(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hs_import_articles(text,jsonb) TO service_role;