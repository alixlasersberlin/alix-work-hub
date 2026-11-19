-- Run in a transaction and roll back; no payment is created by these validation checks.
BEGIN;
DO $$
DECLARE v_user uuid;
BEGIN
  SELECT up.id INTO v_user FROM public.user_profiles up
  JOIN public.user_roles ur ON ur.user_id=up.id JOIN public.roles r ON r.id=ur.role_id
  WHERE up.is_active AND up.account_status='active' AND r.name='Super Admin' LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Testkonto fehlt'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  BEGIN
    PERFORM public.fibu_light_book_payment(gen_random_uuid(),100,current_date,'Bank',NULL,NULL,false);
    RAISE EXCEPTION 'Fehlender Nachweis akzeptiert';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%Zahlungsnachweis%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.fibu_light_book_payment(gen_random_uuid(),100,NULL,'Bank',NULL,jsonb_build_object('evidence','Beleg TEST','request_id',gen_random_uuid())::text,false);
    RAISE EXCEPTION 'Fehlendes Datum akzeptiert';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%Zahlungsdatum%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.fibu_light_book_payment(gen_random_uuid(),0,current_date,'Bank',NULL,jsonb_build_object('evidence','Beleg TEST','request_id',gen_random_uuid())::text,false);
    RAISE EXCEPTION 'Nullbetrag akzeptiert';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%Zahlbetrag%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.fibu_light_book_payment(gen_random_uuid(),100,current_date);
    RAISE EXCEPTION 'Anonym erlaubt';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;