BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
DO $$
BEGIN
 BEGIN PERFORM public.finance_deposit_recalc(gen_random_uuid()); RAISE EXCEPTION 'Internal deposit worker exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.next_invoice_number(current_date); RAISE EXCEPTION 'Internal number reservation exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.assign_invoice_number(gen_random_uuid()); RAISE EXCEPTION 'Numbering without active role accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_invoice_correction(gen_random_uuid(),'storno','isolated regression'); RAISE EXCEPTION 'Correction without active role accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_credit_note(gen_random_uuid(),1,19,'isolated regression'); RAISE EXCEPTION 'Credit without active role accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.gobd_log_invoice_event(gen_random_uuid(),'INVOICE_CREATED'); RAISE EXCEPTION 'Audit without active account accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.mark_credit_note_sent(gen_random_uuid(),'unused@example.invalid'); RAISE EXCEPTION 'Credit state without active role accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS (SELECT 1 FROM sec_private.alixdocs2_fts_search('',20)) THEN RAISE EXCEPTION 'Unassigned caller obtained documents'; END IF;
 IF EXISTS (SELECT 1 FROM sec_private.ac_wfm_adherence_live()) THEN RAISE EXCEPTION 'Unassigned caller obtained staff schedules'; END IF;
END $$;
RESET ROLE;
ROLLBACK;