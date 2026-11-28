CREATE OR REPLACE FUNCTION ph_signal_private.ph2_guard_release_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
   IF TG_TABLE_NAME='ph_settings' AND (NEW.key='ph2_activation' OR (TG_OP='UPDATE' AND OLD.key='ph2_activation')) THEN RAISE EXCEPTION 'Release-Steuerung ausschließlich über geschützte Freigabeprüfung'; END IF;
   IF TG_TABLE_NAME='ph_sync_log' AND NEW.operation IN ('ph2_release_proof','ph2_connection_test','ph2_connection_test_receipt','ph2_mode_change','ph2_emergency_lift','ph2_emergency_stop') THEN RAISE EXCEPTION 'Prüfnachweise ausschließlich durch geschützte Serverabläufe'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ph_signal_private.ph2_guard_release_evidence() FROM public,anon,authenticated;
CREATE TRIGGER ph2_release_settings_guard BEFORE INSERT OR UPDATE ON public.ph_settings FOR EACH ROW EXECUTE FUNCTION ph_signal_private.ph2_guard_release_evidence();
CREATE TRIGGER ph2_release_evidence_guard BEFORE INSERT OR UPDATE ON public.ph_sync_log FOR EACH ROW EXECUTE FUNCTION ph_signal_private.ph2_guard_release_evidence();
DO $$ DECLARE src text; BEGIN
 src:=pg_get_functiondef('ph_signal_private.ph2_set_operating_mode_v10(text,text,uuid,text,integer)'::regprocedure);
 src:=replace(src,'"restore_verified":true,"communication_verified":true','"restore_verified":true');
 EXECUTE src;
END $$;