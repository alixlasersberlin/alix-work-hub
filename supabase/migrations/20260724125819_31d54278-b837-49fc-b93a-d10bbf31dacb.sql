
-- Tighten ac_analytics_events read access to analytics-relevant roles
DROP POLICY IF EXISTS "ac_events staff read" ON public.ac_analytics_events;
CREATE POLICY "ac_events analytics roles read"
ON public.ac_analytics_events
FOR SELECT
TO authenticated
USING (
  has_role('Super Admin'::text)
  OR has_role('Admin'::text)
  OR has_role('Geschäftsführung'::text)
  OR has_role('Vertriebsleitung'::text)
  OR has_role('Marketing'::text)
);

-- Remove anon read on experiments and scope authenticated reads
DROP POLICY IF EXISTS "Anon read active experiments" ON public.ac_web_experiments;
DROP POLICY IF EXISTS "Authenticated read experiments" ON public.ac_web_experiments;
CREATE POLICY "Experiment config internal read"
ON public.ac_web_experiments
FOR SELECT
TO authenticated
USING (
  has_role('Super Admin'::text)
  OR has_role('Admin'::text)
  OR has_role('Geschäftsführung'::text)
  OR has_role('Marketing'::text)
);

REVOKE SELECT ON public.ac_web_experiments FROM anon;
