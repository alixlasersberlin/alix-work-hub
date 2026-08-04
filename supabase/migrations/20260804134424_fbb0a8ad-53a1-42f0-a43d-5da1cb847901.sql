-- 1) Aggressiveres Autovacuum für die stark wachsende/löschende Audit-Tabelle
ALTER TABLE public.audit_logs SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_cost_limit = 2000
);

-- 2) Einmalige sofortige Reorganisation (Bloat: 1.1 GB Heap für 228 MB Daten)
SELECT cron.schedule('audit-logs-vacuum-now', '55 13 4 8 *', 'VACUUM (FULL, ANALYZE) public.audit_logs');