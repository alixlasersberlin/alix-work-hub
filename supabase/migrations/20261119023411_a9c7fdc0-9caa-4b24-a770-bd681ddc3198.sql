DO $test$
DECLARE cases jsonb; c jsonb; back jsonb; counts jsonb; blocked boolean:=false;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','587ff294-b34a-4c45-a8c0-a14a04ba3a8a',true);
 PERFORM set_config('request.jwt.claims','{"sub":"587ff294-b34a-4c45-a8c0-a14a04ba3a8a","role":"authenticated"}',true);
 SET LOCAL ROLE authenticated;
 cases:=public.revision_cases();
 SELECT jsonb_object_agg(category,n) INTO counts FROM (SELECT value->>'category' category,count(*) n FROM jsonb_array_elements(cases) GROUP BY 1) x;
 IF jsonb_array_length(cases)=0 THEN RAISE EXCEPTION 'Expected real revision cases'; END IF;
 c:=cases->0;
 BEGIN
   PERFORM public.revision_review(c->>'case_key','in_progress','Revisionsprüfung: zurückgenommener Testvermerk');
   SELECT value INTO back FROM jsonb_array_elements(public.revision_cases()) WHERE value->>'case_key'=c->>'case_key';
   IF back->>'review_status'<>'in_progress' OR back->>'review_note'<>'Revisionsprüfung: zurückgenommener Testvermerk' THEN RAISE EXCEPTION 'Review read-back failed'; END IF;
   RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='Rollback test note';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 BEGIN
   PERFORM public.revision_review(c->>'case_key','reviewed','a');
   RAISE EXCEPTION 'Short note accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='Short note accepted' THEN RAISE; END IF;
 END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.revision_cases(); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Signed-out access not blocked'; END IF;
 RESET ROLE;
 RAISE NOTICE 'Revision tests passed, real cases: %',counts;
END $test$;