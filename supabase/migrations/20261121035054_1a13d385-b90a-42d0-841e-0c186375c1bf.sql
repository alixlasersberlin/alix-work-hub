DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.ph_global_claim_release(uuid,text,jsonb)'::regprocedure);
 definition:=replace(definition,'INSERT INTO public.ph_sync_log(channel_code,action,status,payload)','INSERT INTO public.ph_sync_log(channel_code,operation,status,payload)');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.ph_global_finish_release(uuid,text,uuid,jsonb,boolean)'::regprocedure);
 definition:=replace(definition,'END,response=p_reply WHERE channel_code','END,payload=coalesce(payload,''{}''::jsonb)||jsonb_build_object(''reply'',p_reply) WHERE channel_code');
 definition:=replace(definition,'AND action=''global_direct_release''','AND operation=''global_direct_release''');
 EXECUTE definition;
END $$;