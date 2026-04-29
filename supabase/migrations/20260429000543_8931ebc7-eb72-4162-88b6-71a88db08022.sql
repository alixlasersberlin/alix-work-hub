
-- Steckengebliebenen alten "processing"-Eintrag als failed markieren
UPDATE public.order_import_logs
SET import_status = 'failed',
    message = COALESCE(message, '') || ' · Abgebrochen (kein Abschluss erfasst)'
WHERE import_status = 'processing'
  AND created_at < now() - interval '1 hour';

-- Backfill: für jeden bisherigen Zoho-Import-Aufruf einen Log-Eintrag erzeugen,
-- falls noch kein Eintrag mit derselben job_id existiert.
INSERT INTO public.order_import_logs (
  source_system, import_status, message, imported_by, created_at
)
SELECT
  COALESCE(al.details->>'source_system', 'zoho_eu_1') AS source_system,
  'success' AS import_status,
  CONCAT(
    'Manueller Import ',
    COALESCE(al.details->>'entity', 'contacts'),
    ' · Job ', COALESCE(al.details->>'job_id', al.id::text),
    ' (Backfill aus Audit-Log)'
  ) AS message,
  al.user_id AS imported_by,
  al.created_at
FROM public.audit_logs al
WHERE al.action IN ('start_zoho_import','dry_run_zoho_import')
  AND al.module = 'import_management'
  AND NOT EXISTS (
    SELECT 1 FROM public.order_import_logs oil
    WHERE oil.message LIKE '%' || COALESCE(al.details->>'job_id','__none__') || '%'
  );
