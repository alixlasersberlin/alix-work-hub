
-- Segments
CREATE TABLE IF NOT EXISTS public.finance_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_region public.accounting_region NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (accounting_region, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_segments TO authenticated;
GRANT ALL ON public.finance_segments TO service_role;
ALTER TABLE public.finance_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_segments_read"
ON public.finance_segments FOR SELECT TO authenticated
USING (
  public.has_role('Super Admin') OR
  public.has_role('Admin') OR
  public.has_role('Finance') OR
  public.has_role('Buchhaltung Admin') OR
  public.has_role('Buchhaltung EU') OR
  public.has_role('Buchhaltung CH')
);
CREATE POLICY "finance_segments_write"
ON public.finance_segments FOR ALL TO authenticated
USING (
  public.has_role('Super Admin') OR
  public.has_role('Admin') OR
  public.has_role('Buchhaltung Admin') OR
  public.has_role('Buchhaltung EU') OR
  public.has_role('Buchhaltung CH')
)
WITH CHECK (
  public.has_role('Super Admin') OR
  public.has_role('Admin') OR
  public.has_role('Buchhaltung Admin') OR
  public.has_role('Buchhaltung EU') OR
  public.has_role('Buchhaltung CH')
);

CREATE TRIGGER trg_finance_segments_updated
BEFORE UPDATE ON public.finance_segments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend finance_transactions
ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_unit_id UUID REFERENCES public.finance_cost_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.finance_segments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_category TEXT
    CHECK (line_category IS NULL OR line_category IN ('revenue','variable_cost','fixed_cost','other'));

CREATE INDEX IF NOT EXISTS idx_ftx_cc ON public.finance_transactions(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_ftx_cu ON public.finance_transactions(cost_unit_id);
CREATE INDEX IF NOT EXISTS idx_ftx_seg ON public.finance_transactions(segment_id);
CREATE INDEX IF NOT EXISTS idx_ftx_region_date ON public.finance_transactions(accounting_region, booking_date);

-- RPC: Cost Center Report
CREATE OR REPLACE FUNCTION public.finance_cost_center_report(
  p_region public.accounting_region,
  p_from DATE,
  p_to DATE
) RETURNS TABLE (
  cost_center_id UUID,
  code TEXT,
  name TEXT,
  revenue NUMERIC,
  variable_cost NUMERIC,
  fixed_cost NUMERIC,
  db1 NUMERIC,
  db2 NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    cc.id,
    cc.code,
    cc.name,
    COALESCE(SUM(CASE WHEN t.line_category='revenue' THEN t.amount END),0)::NUMERIC AS revenue,
    COALESCE(SUM(CASE WHEN t.line_category='variable_cost' THEN ABS(t.amount) END),0)::NUMERIC AS variable_cost,
    COALESCE(SUM(CASE WHEN t.line_category='fixed_cost' THEN ABS(t.amount) END),0)::NUMERIC AS fixed_cost,
    (COALESCE(SUM(CASE WHEN t.line_category='revenue' THEN t.amount END),0)
     - COALESCE(SUM(CASE WHEN t.line_category='variable_cost' THEN ABS(t.amount) END),0))::NUMERIC AS db1,
    (COALESCE(SUM(CASE WHEN t.line_category='revenue' THEN t.amount END),0)
     - COALESCE(SUM(CASE WHEN t.line_category='variable_cost' THEN ABS(t.amount) END),0)
     - COALESCE(SUM(CASE WHEN t.line_category='fixed_cost' THEN ABS(t.amount) END),0))::NUMERIC AS db2
  FROM public.finance_cost_centers cc
  LEFT JOIN public.finance_transactions t
    ON t.cost_center_id = cc.id
   AND t.booking_date BETWEEN p_from AND p_to
   AND t.accounting_region = p_region
  WHERE cc.accounting_region = p_region
    AND cc.is_active = true
  GROUP BY cc.id, cc.code, cc.name
  ORDER BY cc.code;
$$;

-- RPC: Segment Report
CREATE OR REPLACE FUNCTION public.finance_segment_report(
  p_region public.accounting_region,
  p_from DATE,
  p_to DATE
) RETURNS TABLE (
  segment_id UUID,
  code TEXT,
  name TEXT,
  revenue NUMERIC,
  variable_cost NUMERIC,
  fixed_cost NUMERIC,
  result NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.id, s.code, s.name,
    COALESCE(SUM(CASE WHEN t.line_category='revenue' THEN t.amount END),0)::NUMERIC,
    COALESCE(SUM(CASE WHEN t.line_category='variable_cost' THEN ABS(t.amount) END),0)::NUMERIC,
    COALESCE(SUM(CASE WHEN t.line_category='fixed_cost' THEN ABS(t.amount) END),0)::NUMERIC,
    (COALESCE(SUM(CASE WHEN t.line_category='revenue' THEN t.amount END),0)
     - COALESCE(SUM(CASE WHEN t.line_category IN ('variable_cost','fixed_cost') THEN ABS(t.amount) END),0))::NUMERIC AS result
  FROM public.finance_segments s
  LEFT JOIN public.finance_transactions t
    ON t.segment_id = s.id
   AND t.booking_date BETWEEN p_from AND p_to
   AND t.accounting_region = p_region
  WHERE s.accounting_region = p_region
    AND s.is_active = true
  GROUP BY s.id, s.code, s.name
  ORDER BY s.code;
$$;

-- RPC: DB1/DB2 total
CREATE OR REPLACE FUNCTION public.finance_db_summary(
  p_region public.accounting_region,
  p_from DATE,
  p_to DATE
) RETURNS TABLE (
  revenue NUMERIC,
  variable_cost NUMERIC,
  db1 NUMERIC,
  fixed_cost NUMERIC,
  db2 NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(CASE WHEN line_category='revenue' THEN amount END),0)::NUMERIC AS revenue,
    COALESCE(SUM(CASE WHEN line_category='variable_cost' THEN ABS(amount) END),0)::NUMERIC AS variable_cost,
    (COALESCE(SUM(CASE WHEN line_category='revenue' THEN amount END),0)
     - COALESCE(SUM(CASE WHEN line_category='variable_cost' THEN ABS(amount) END),0))::NUMERIC AS db1,
    COALESCE(SUM(CASE WHEN line_category='fixed_cost' THEN ABS(amount) END),0)::NUMERIC AS fixed_cost,
    (COALESCE(SUM(CASE WHEN line_category='revenue' THEN amount END),0)
     - COALESCE(SUM(CASE WHEN line_category IN ('variable_cost','fixed_cost') THEN ABS(amount) END),0))::NUMERIC AS db2
  FROM public.finance_transactions
  WHERE accounting_region = p_region
    AND booking_date BETWEEN p_from AND p_to;
$$;

GRANT EXECUTE ON FUNCTION public.finance_cost_center_report(public.accounting_region,DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_segment_report(public.accounting_region,DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_db_summary(public.accounting_region,DATE,DATE) TO authenticated;
