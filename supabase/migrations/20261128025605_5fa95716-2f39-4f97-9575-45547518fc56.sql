CREATE OR REPLACE FUNCTION ph_signal_private.ph2_release_admin()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM ph_signal_private.ph2_require_super_admin(); RETURN true;
EXCEPTION WHEN raise_exception THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION ph_signal_private.ph2_release_admin() FROM public,anon;
GRANT EXECUTE ON FUNCTION ph_signal_private.ph2_release_admin() TO authenticated;
CREATE OR REPLACE FUNCTION public.ph2_release_admin() RETURNS boolean LANGUAGE sql STABLE SET search_path=public AS $$ SELECT ph_signal_private.ph2_release_admin() $$;
REVOKE ALL ON FUNCTION public.ph2_release_admin() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.ph2_release_admin() TO authenticated;
INSERT INTO public.ph_sync_log(direction,operation,status,message,payload)
VALUES('internal','ph2_release_proof','error','Sicherheitsprüfung v1.1: Freigabe gesperrt; endgültige Bewertung ausstehend',
jsonb_build_object('kind','security','passed',false,'complete',false,'context',ph_signal_private.ph2_release_context(NULL),'checked_at',clock_timestamp(),'source','read_only_database_audit','linter_count',493,'confirmed_high',1,'confirmed_critical',0,'result','Gesperrt: geerbte Super-Admin-Prüfung erlaubt Admin die Product-Hub-Löschung; weitere 493 Hinweise nur vorläufig klassifiziert','report','docs/producthub-2/sicherheit-v1-1.md'));