DELETE FROM public.collect_health_scores a USING public.collect_health_scores b
  WHERE a.customer_name = b.customer_name AND a.ctid > b.ctid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_collect_health_name ON public.collect_health_scores (customer_name);