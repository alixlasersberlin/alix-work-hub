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