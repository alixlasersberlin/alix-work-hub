SET LOCAL ROLE anon;
DO $probe$
BEGIN
  BEGIN
    PERFORM public.ph2_record_release_proof('security',NULL,true,'{"complete":true,"confirmed_high":0,"confirmed_critical":0}'::jsonb,'00000000-0000-0000-0000-000000000000'::uuid);
    RAISE EXCEPTION 'Unexpected anonymous proof capability';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000000"}',true);
DO $probe$
BEGIN
  BEGIN
    PERFORM public.ph2_record_release_proof('security',NULL,true,'{"complete":true,"confirmed_high":0,"confirmed_critical":0}'::jsonb,'00000000-0000-0000-0000-000000000000'::uuid);
    RAISE EXCEPTION 'Unexpected authenticated proof capability';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.ph_sync_log(direction,operation,status,message,payload)
    VALUES('internal','ph2_release_proof','ok','isolated denied proof probe','{"kind":"security","passed":true,"complete":true,"confirmed_high":0,"confirmed_critical":0}'::jsonb);
    RAISE EXCEPTION 'Unexpected client proof injection accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Geschützter PRODUCT-HUB-Nachweis oder Betriebsmodus' THEN RAISE; END IF;
  END;
END
$probe$;
RESET ROLE;