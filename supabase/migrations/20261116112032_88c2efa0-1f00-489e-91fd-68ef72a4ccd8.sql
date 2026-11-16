DO $$ DECLARE expected_count bigint; visible_count bigint; history_count bigint; followup_count bigint; u uuid; BEGIN
SELECT count(*) INTO expected_count FROM public.sales_leads;
PERFORM set_config('request.jwt.claim.sub','45820f2c-6d6c-4067-9816-cc6dc4500db4',true);
EXECUTE 'SET LOCAL ROLE authenticated';
IF NOT lead_private.ml_inquiry_reader() THEN RAISE EXCEPTION 'Authenticated reader gate failed'; END IF;
IF lead_private.ml_super_admin() THEN RAISE EXCEPTION 'Write gate unexpectedly open'; END IF;
SELECT count(*) INTO visible_count FROM public.sales_leads;
SELECT count(*) INTO history_count FROM public.sales_lead_history;
SELECT count(*) INTO followup_count FROM public.sales_followups;
IF visible_count <> expected_count OR visible_count=0 THEN RAISE EXCEPTION 'Inquiry visibility mismatch: % versus %',visible_count,expected_count; END IF;
EXECUTE 'RESET ROLE';
RAISE NOTICE 'Verified L. Scheidler: % visible inquiries, % history entries, % follow-ups; write gate closed',visible_count,history_count,followup_count;
FOR u IN SELECT id FROM public.user_profiles WHERE id<>'45820f2c-6d6c-4067-9816-cc6dc4500db4' LOOP
PERFORM set_config('request.jwt.claim.sub',u::text,true);
IF lead_private.ml_inquiry_reader() THEN RAISE EXCEPTION 'Unexpected reader exception for another account'; END IF;
END LOOP;
PERFORM set_config('request.jwt.claim.sub','',true);
IF lead_private.ml_inquiry_reader() THEN RAISE EXCEPTION 'Signed-out reader gate unexpectedly open'; END IF;
END $$;