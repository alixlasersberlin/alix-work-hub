GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_locks TO authenticated;
GRANT ALL ON public.device_locks TO service_role;

GRANT SELECT (id, filename, file_type, row_count, created_by, created_at, updated_at) ON public.device_lock_imports TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.device_lock_imports TO authenticated;
GRANT ALL ON public.device_lock_imports TO service_role;