
-- 1) Generic audit change trigger
CREATE OR REPLACE FUNCTION public.audit_capture_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text;
  v_old text;
  v_new text;
  v_rec_id text;
BEGIN
  v_rec_id := COALESCE(NEW.id::text, OLD.id::text);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_changes(user_id, table_name, record_id, field_name, old_value, new_value, operation)
    VALUES (v_uid, TG_TABLE_NAME, v_rec_id, NULL, NULL, NULL, 'INSERT');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_changes(user_id, table_name, record_id, field_name, old_value, new_value, operation)
    VALUES (v_uid, TG_TABLE_NAME, v_rec_id, NULL, NULL, NULL, 'DELETE');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    FOR v_key IN
      SELECT key FROM jsonb_each(to_jsonb(NEW))
    LOOP
      IF v_key IN ('updated_at','created_at','last_synced_at','last_heartbeat_at') THEN CONTINUE; END IF;
      v_old := (to_jsonb(OLD) ->> v_key);
      v_new := (to_jsonb(NEW) ->> v_key);
      IF v_old IS DISTINCT FROM v_new THEN
        INSERT INTO public.audit_changes(user_id, table_name, record_id, field_name, old_value, new_value, operation)
        VALUES (v_uid, TG_TABLE_NAME, v_rec_id, v_key,
                LEFT(COALESCE(v_old,''), 2000),
                LEFT(COALESCE(v_new,''), 2000),
                'UPDATE');
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END $$;

-- Attach triggers (drop first to be idempotent)
DROP TRIGGER IF EXISTS trg_audit_orders ON public.orders;
CREATE TRIGGER trg_audit_orders
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.audit_capture_changes();

DROP TRIGGER IF EXISTS trg_audit_alixdocs2_documents ON public.alixdocs2_documents;
CREATE TRIGGER trg_audit_alixdocs2_documents
AFTER INSERT OR UPDATE OR DELETE ON public.alixdocs2_documents
FOR EACH ROW EXECUTE FUNCTION public.audit_capture_changes();

DROP TRIGGER IF EXISTS trg_audit_user_profiles ON public.user_profiles;
CREATE TRIGGER trg_audit_user_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_capture_changes();

-- 2) Retention purge function
CREATE OR REPLACE FUNCTION public.audit_retention_purge()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - interval '24 months';
  v_a bigint; v_c bigint; v_s bigint; v_l bigint;
BEGIN
  DELETE FROM public.audit_actions WHERE ts < v_cutoff;
  GET DIAGNOSTICS v_a = ROW_COUNT;
  DELETE FROM public.audit_changes WHERE ts < v_cutoff;
  GET DIAGNOSTICS v_c = ROW_COUNT;
  DELETE FROM public.audit_access_log WHERE ts < v_cutoff;
  GET DIAGNOSTICS v_l = ROW_COUNT;
  DELETE FROM public.audit_sessions WHERE started_at < v_cutoff;
  GET DIAGNOSTICS v_s = ROW_COUNT;
  RETURN jsonb_build_object(
    'cutoff', v_cutoff,
    'actions_deleted', v_a,
    'changes_deleted', v_c,
    'access_deleted', v_l,
    'sessions_deleted', v_s
  );
END $$;

-- Schedule daily 03:30 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('audit-retention-purge');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'audit-retention-purge',
  '30 3 * * *',
  $$ SELECT public.audit_retention_purge(); $$
);
