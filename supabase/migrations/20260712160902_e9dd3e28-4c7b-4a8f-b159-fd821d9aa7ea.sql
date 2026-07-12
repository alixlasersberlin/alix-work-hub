
CREATE OR REPLACE VIEW public.bug_capa_trend_30d
WITH (security_invoker = on) AS
SELECT day::date AS day, 'bug'::text AS kind, count(*)::int AS cnt
FROM public.bugs, generate_series(now() - interval '29 days', now(), interval '1 day') AS day
WHERE date_trunc('day', created_at) = date_trunc('day', day) GROUP BY day
UNION ALL
SELECT day::date, 'capa', count(*)::int
FROM public.capas, generate_series(now() - interval '29 days', now(), interval '1 day') AS day
WHERE date_trunc('day', created_at) = date_trunc('day', day) GROUP BY day
UNION ALL
SELECT day::date, 'finding', count(*)::int
FROM public.audit_findings, generate_series(now() - interval '29 days', now(), interval '1 day') AS day
WHERE date_trunc('day', created_at) = date_trunc('day', day) GROUP BY day;

GRANT SELECT ON public.bug_capa_trend_30d TO authenticated, service_role;

CREATE OR REPLACE VIEW public.capa_mttr_stats
WITH (security_invoker = on) AS
SELECT
  round(avg(extract(epoch FROM (closure_approved_at - created_at)) / 86400)::numeric, 1) AS mttr_days_all,
  round(avg(extract(epoch FROM (closure_approved_at - created_at)) / 86400)
    FILTER (WHERE closure_approved_at >= now() - interval '90 days')::numeric, 1) AS mttr_days_90d,
  count(*) FILTER (WHERE closure_approved_at IS NOT NULL)::int AS closed_total,
  count(*) FILTER (WHERE status != 'geschlossen')::int AS open_total,
  count(*) FILTER (WHERE effectiveness_ok = true)::int AS effective_count,
  count(*) FILTER (WHERE effectiveness_ok = false)::int AS ineffective_count
FROM public.capas;

GRANT SELECT ON public.capa_mttr_stats TO authenticated, service_role;

CREATE OR REPLACE VIEW public.bug_overdue
WITH (security_invoker = on) AS
SELECT id, ticket_number, title, priority, criticality, status, due_date,
  (current_date - due_date)::int AS overdue_days, assignee_id
FROM public.bugs
WHERE status NOT IN ('geschlossen','erledigt') AND due_date IS NOT NULL AND due_date < current_date
ORDER BY overdue_days DESC;

GRANT SELECT ON public.bug_overdue TO authenticated, service_role;

CREATE OR REPLACE VIEW public.capa_overdue
WITH (security_invoker = on) AS
SELECT id, capa_number, title, status, due_date,
  (current_date - due_date)::int AS overdue_days, responsible_id
FROM public.capas
WHERE status != 'geschlossen' AND due_date IS NOT NULL AND due_date < current_date
ORDER BY overdue_days DESC;

GRANT SELECT ON public.capa_overdue TO authenticated, service_role;
