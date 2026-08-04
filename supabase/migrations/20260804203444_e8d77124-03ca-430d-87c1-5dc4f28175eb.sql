CREATE TABLE public.perf_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  scope text NOT NULL DEFAULT 'route',
  route text,
  kind text,
  target text,
  calls integer NOT NULL DEFAULT 0,
  avg_ms numeric NOT NULL DEFAULT 0,
  p95_ms numeric NOT NULL DEFAULT 0,
  max_ms numeric NOT NULL DEFAULT 0,
  total_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.perf_metric_snapshots TO authenticated;
GRANT ALL ON public.perf_metric_snapshots TO service_role;

ALTER TABLE public.perf_metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_snapshots_admin_read" ON public.perf_metric_snapshots
FOR SELECT TO authenticated
USING (public.has_role('Admin') OR public.has_role('Super Admin'));

CREATE POLICY "perf_snapshots_admin_insert" ON public.perf_metric_snapshots
FOR INSERT TO authenticated
WITH CHECK ((public.has_role('Admin') OR public.has_role('Super Admin')) AND created_by = (select auth.uid()));

CREATE INDEX idx_perf_snapshots_captured ON public.perf_metric_snapshots (captured_at DESC);
CREATE INDEX idx_perf_snapshots_route ON public.perf_metric_snapshots (route, captured_at DESC);