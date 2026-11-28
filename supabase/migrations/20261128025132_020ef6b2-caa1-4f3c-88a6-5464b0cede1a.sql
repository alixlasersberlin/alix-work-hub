CREATE OR REPLACE FUNCTION ph_signal_private.ph2_guard_release_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
   IF TG_TABLE_NAME='ph_settings' THEN
     IF NEW.key='ph2_activation' THEN RAISE EXCEPTION 'Release-Steuerung ausschließlich über geschützte Freigabeprüfung'; END IF;
     IF TG_OP='UPDATE' THEN IF OLD.key='ph2_activation' THEN RAISE EXCEPTION 'Release-Steuerung ausschließlich über geschützte Freigabeprüfung'; END IF; END IF;
   ELSIF TG_TABLE_NAME='ph_sync_log' THEN
     IF NEW.operation IN ('ph2_release_proof','ph2_connection_test','ph2_connection_test_receipt','ph2_mode_change','ph2_emergency_lift','ph2_emergency_stop') THEN RAISE EXCEPTION 'Prüfnachweise ausschließlich durch geschützte Serverabläufe'; END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;