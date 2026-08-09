
REVOKE ALL ON FUNCTION public.dispatch_sync_appointment_to_calendar(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dispatch_sync_all_appointments_to_calendar() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_dispatch_calendar_sync() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_sync_appointment_to_calendar(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispatch_sync_all_appointments_to_calendar() TO authenticated, service_role;
