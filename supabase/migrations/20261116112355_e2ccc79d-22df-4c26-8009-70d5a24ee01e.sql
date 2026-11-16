DO $$ DECLARE tid uuid; creator uuid; BEGIN
BEGIN
PERFORM set_config('request.jwt.claim.sub','7212fdcc-3bc3-4092-85cc-f96c6821c21e',true);
EXECUTE 'SET LOCAL ROLE authenticated';
INSERT INTO public.tickets(title,source_system,status,priority,department,customer_visible_status,auto_notify_customer,created_by) VALUES ('Interne zurückgerollte Berechtigungsprüfung','alixwork','offen','normal','service','Ticket eingegangen',false,'45820f2c-6d6c-4067-9816-cc6dc4500db4') RETURNING id,created_by INTO tid,creator;
IF creator<>'7212fdcc-3bc3-4092-85cc-f96c6821c21e' THEN RAISE EXCEPTION 'Creator stamp failed'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.tickets WHERE id=tid AND title='Interne zurückgerollte Berechtigungsprüfung') THEN RAISE EXCEPTION 'Created ticket cannot be reopened'; END IF;
BEGIN
UPDATE public.tickets SET created_by='45820f2c-6d6c-4067-9816-cc6dc4500db4' WHERE id=tid;
RAISE EXCEPTION 'Creator modification unexpectedly allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
EXECUTE 'RESET ROLE';
RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='Verified creation and read-back; rolling back test';
EXCEPTION WHEN SQLSTATE 'ZX001' THEN RAISE NOTICE 'Sanae ticket creation and reopening verified; no test ticket retained';
END;
END $$;