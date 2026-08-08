DROP INDEX IF EXISTS public.uq_collect_health_customer;
DELETE FROM public.collect_health_scores a USING public.collect_health_scores b
  WHERE a.customer_id IS NOT NULL AND a.customer_id = b.customer_id AND a.ctid > b.ctid;
CREATE UNIQUE INDEX uq_collect_health_customer ON public.collect_health_scores (customer_id);