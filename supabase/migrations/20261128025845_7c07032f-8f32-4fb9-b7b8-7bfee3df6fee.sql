-- Rollback-only regression. Execute via the migration tool as the database owner.
DO $$ DECLARE pilot uuid; other uuid; sa uuid; old_value jsonb; got boolean; BEGIN
 SELECT id INTO pilot FROM public.ph_products ORDER BY id LIMIT 1;
 SELECT id INTO other FROM public.ph_products WHERE id<>pilot ORDER BY id LIMIT 1;
 SELECT p.id INTO sa FROM public.user_profiles p JOIN public.user_roles ur ON ur.user_id=p.id JOIN public.roles r ON r.id=ur.role_id WHERE r.name='Super Admin' AND p.account_status='active' AND p.invitation_status='accepted' AND p.password_reset_required=false LIMIT 1;
 IF pilot IS NULL OR other IS NULL OR sa IS NULL THEN RAISE EXCEPTION 'Test fixtures unavailable'; END IF;
 BEGIN
  UPDATE public.ph_settings SET value=value||jsonb_build_object('enabled',true,'backup_verified',true,'restore_verified',true,'communication_verified',true,'approved_by',sa,'emergency_stopped',false,'channels',jsonb_build_object('de',jsonb_build_object('mode','pilot','pilot_product_id',pilot),'com',jsonb_build_object('mode','blocked','pilot_product_id',null))) WHERE key='ph2_activation';
  IF NOT public.ph2_channel_allowed('de',pilot) THEN RAISE EXCEPTION 'Selected pilot blocked'; END IF;
  IF public.ph2_channel_allowed('de',other) THEN RAISE EXCEPTION 'Second device allowed'; END IF;
  IF public.ph2_channel_allowed('com',pilot) THEN RAISE EXCEPTION 'COM implicitly released'; END IF;
  IF public.ph2_channel_allowed('us',pilot) THEN RAISE EXCEPTION 'US allowed'; END IF;
  UPDATE public.ph_settings SET value=value||'{"emergency_stopped":true}'::jsonb WHERE key='ph2_activation';
  IF public.ph2_channel_allowed('de',pilot) THEN RAISE EXCEPTION 'Emergency stop failed'; END IF;
  UPDATE public.ph_settings SET value=value||'{"emergency_stopped":false,"restore_verified":false}'::jsonb WHERE key='ph2_activation';
  IF public.ph2_channel_allowed('de',pilot) THEN RAISE EXCEPTION 'Restore bypassed'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',sa,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  got:=false;
  BEGIN PERFORM public.ph2_set_operating_mode('de','pilot',pilot,'FREIGABE DE PILOT',0); EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Nachweis für Vollsicherung%' AND SQLERRM NOT LIKE '%Nachweis backup%' THEN RAISE; END IF; got:=true; END;
  IF NOT got THEN RAISE EXCEPTION 'Missing backup/restore accepted'; END IF;
  got:=false;
  BEGIN PERFORM public.ph2_set_operating_mode('de','blocked',null,'',0); EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Sicherheitsbestätigung fehlt%' THEN RAISE; END IF; got:=true; END;
  IF NOT got THEN RAISE EXCEPTION 'Missing confirmation accepted'; END IF;
  got:=false;
  BEGIN PERFORM public.ph2_record_pilot_check('de',pilot,'images',true,'Isolierter Prüfnachweis',null); EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%signierte produktive Empfangsbestätigung%' THEN RAISE; END IF; got:=true; END;
  IF NOT got THEN RAISE EXCEPTION 'Unproven image check accepted'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  got:=false;
  BEGIN PERFORM public.ph2_stop_production(); EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%aktiver Super Admin%' THEN RAISE; END IF; got:=true; END;
  IF NOT got THEN RAISE EXCEPTION 'Unknown caller could stop production'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'ph2_test_rollback';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ph2_test_rollback' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'PRODUCT HUB operating mode: 10 rollback checks passed; no product or live state changed';
END $$;
-- Owner-run, rollback-only regression. Never calls a successful release or external API.
DO $$
DECLARE apex uuid; k text; ctx text; p jsonb; blocked boolean; lid uuid; ids uuid[] := '{}';
BEGIN
 SELECT id INTO apex FROM public.ph_products WHERE slug='alix-apex';
 IF apex IS NULL THEN RAISE EXCEPTION 'Apex fixture missing'; END IF;
 IF has_function_privilege('authenticated','public.ph2_record_release_proof(text,text,boolean,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Caller can forge proof'; END IF;
 IF has_function_privilege('authenticated','ph_signal_private.ph2_set_operating_mode_v10(text,text,uuid,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'Legacy mode bypass'; END IF;
 IF has_function_privilege('anon','public.ph2_set_operating_mode(text,text,uuid,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous release'; END IF;
 BEGIN
  FOREACH k IN ARRAY ARRAY['backup','restore','bundle','communication','pilot_dry_run','security'] LOOP
   ctx:=ph_signal_private.ph2_release_context(CASE WHEN k IN ('backup','restore','security') THEN NULL ELSE 'de' END);
   p:=jsonb_build_object('kind',k,'passed',true,'context',ctx,'backup_created_at',clock_timestamp(),'isolated',true,'complete',true,'manifest_verified',true,'read_api_verified',true,'local_product_id',apex,'slug','alix-apex','receiver_confirmed',true);
   INSERT INTO public.ph_sync_log(channel_code,direction,operation,status,payload,created_at) VALUES(CASE WHEN k IN ('backup','restore','security') THEN NULL ELSE 'de' END,'internal','ph2_release_proof','ok',p,clock_timestamp()+interval '1 minute') RETURNING id INTO lid;
   ids:=array_append(ids,lid);
  END LOOP;
  INSERT INTO public.ph_sync_log(channel_code,direction,operation,status,payload,created_at) VALUES('de','internal','ph2_connection_test','ok',jsonb_build_object('result','accepted','signature','verified','receipt',true,'context',ph_signal_private.ph2_release_context('de')),clock_timestamp()+interval '1 minute') RETURNING id INTO lid;
  ids:=array_append(ids,lid);
  -- Positive matrix evaluation is read-only: it cannot activate a pilot or stop.
  PERFORM ph_signal_private.ph2_require_release_matrix('de',apex);
  -- Every mandatory proof fails independently; no synthetic success activates a mode.
  FOREACH k IN ARRAY ARRAY['backup','restore','bundle','communication','pilot_dry_run','security'] LOOP
   BEGIN
    UPDATE public.ph_sync_log SET payload=payload||'{"passed":false}'::jsonb WHERE id=ANY(ids) AND payload->>'kind'=k;
    blocked:=false;
    BEGIN PERFORM ph_signal_private.ph2_require_release_matrix('de',apex); EXCEPTION WHEN OTHERS THEN blocked:=position('Nachweis '||k in SQLERRM)>0; END;
    IF NOT blocked THEN RAISE EXCEPTION 'Missing mandatory proof accepted: %',k; END IF;
    RAISE EXCEPTION 'case_rollback';
   EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'case_rollback' THEN RAISE; END IF; END;
  END LOOP;
  BEGIN
   UPDATE public.ph_sync_log SET created_at=clock_timestamp()-interval '25 hours' WHERE operation='ph2_release_proof' AND payload->>'kind'='backup';
   blocked:=false; BEGIN PERFORM ph_signal_private.ph2_require_release_matrix('de',apex); EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%Nachweis backup%'; END;
   IF NOT blocked THEN RAISE EXCEPTION 'Proof older than 24 hours accepted'; END IF;
   RAISE EXCEPTION 'case_rollback';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'case_rollback' THEN RAISE; END IF; END;
  blocked:=false; BEGIN PERFORM ph_signal_private.ph2_require_release_matrix('com',apex); EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%Nachweis bundle%'; END;
  IF NOT blocked THEN RAISE EXCEPTION 'DE proofs satisfied COM'; END IF;
  BEGIN
   UPDATE public.ph_sync_log SET payload=payload||jsonb_build_object('context','changed-configuration') WHERE id=ANY(ids) AND payload->>'kind'='bundle';
   blocked:=false; BEGIN PERFORM ph_signal_private.ph2_require_release_matrix('de',apex); EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%Nachweis bundle%'; END;
   IF NOT blocked THEN RAISE EXCEPTION 'Changed configuration accepted'; END IF;
   RAISE EXCEPTION 'case_rollback';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'case_rollback' THEN RAISE; END IF; END;
  BEGIN
   -- No old success may resurrect after the latest failure.
   UPDATE public.ph_sync_log SET payload=payload||'{"isolated":false}'::jsonb WHERE id=ANY(ids) AND payload->>'kind'='restore';
   blocked:=false; BEGIN PERFORM ph_signal_private.ph2_require_release_matrix('de',apex); EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%Isolierte Wiederherstellung%'; END;
   IF NOT blocked THEN RAISE EXCEPTION 'Memory-only restore accepted'; END IF;
   RAISE EXCEPTION 'case_rollback';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'case_rollback' THEN RAISE; END IF; END;
  -- Switching to another device must never use an Apex proof.
  BEGIN
   UPDATE public.ph_sync_log SET payload=payload||jsonb_build_object('local_product_id',gen_random_uuid()) WHERE id=ANY(ids) AND payload->>'kind'='pilot_dry_run';
   blocked:=false; BEGIN PERFORM ph_signal_private.ph2_require_release_matrix('de',apex); EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%Apex-Pilotnachweis%'; END;
   IF NOT blocked THEN RAISE EXCEPTION 'Wrong pilot identity accepted'; END IF;
   RAISE EXCEPTION 'case_rollback';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'case_rollback' THEN RAISE; END IF; END;
  EXECUTE 'SET LOCAL ROLE authenticated';
  blocked:=false;
  BEGIN INSERT INTO public.ph_sync_log(direction,operation,status,payload) VALUES('internal','ph2_release_proof','ok','{"kind":"security","passed":true}'); EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%Prüfnachweise ausschließlich%' OR SQLERRM LIKE '%Geschützter PRODUCT-HUB-Nachweis%' OR SQLSTATE='42501'; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Client proof injection accepted'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'ph2_v11_rollback';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ph2_v11_rollback' THEN RAISE; END IF; END;
 RAISE NOTICE 'Release Control v1.1 rollback tests passed; no pilot/production activation or product writes';
END $$;