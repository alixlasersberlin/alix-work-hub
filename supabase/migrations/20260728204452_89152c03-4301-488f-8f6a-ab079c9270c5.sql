-- 1) Kill the noisy audit trigger (backup progress messages are not audit-relevant)
DROP TRIGGER IF EXISTS trg_audit_backups_metadata ON public.backups_metadata;

-- 2) Purge historical noise + old rows
DELETE FROM public.audit_logs WHERE module = 'backups_metadata';
DELETE FROM public.audit_logs WHERE created_at < now() - interval '180 days';

-- 3) Reclaim space and refresh planner stats
ANALYZE public.audit_logs;
ANALYZE public.backups_metadata;