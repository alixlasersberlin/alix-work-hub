DROP TRIGGER ph2_release_settings_guard ON public.ph_settings;
DROP TRIGGER ph2_release_evidence_guard ON public.ph_sync_log;
DROP FUNCTION ph_signal_private.ph2_guard_release_evidence();