DO $probe$
DECLARE context_value text; severity_kind text; details jsonb;
BEGIN
  context_value := public.ph2_release_context(NULL);
  FOREACH severity_kind IN ARRAY ARRAY['confirmed_critical','confirmed_high'] LOOP
    details := jsonb_build_object('context',context_value,'complete',true,'confirmed_critical',0,'confirmed_high',0) || jsonb_build_object(severity_kind,1);
    BEGIN
      PERFORM public.ph2_record_release_proof('security',NULL,true,details,'00000000-0000-0000-0000-000000000000'::uuid);
      RAISE EXCEPTION 'Unexpected successful proof with blocking risks';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Sicherheitsprüfung unvollständig oder blockierend' THEN RAISE; END IF;
    END;
  END LOOP;
END
$probe$;