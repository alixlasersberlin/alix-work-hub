
-- Phase 9: extend device_lifecycle with reference_table/metadata aliases + device_health_scores
ALTER TABLE public.device_lifecycle
  ADD COLUMN IF NOT EXISTS reference_table text GENERATED ALWAYS AS (event_source) STORED,
  ADD COLUMN IF NOT EXISTS metadata jsonb GENERATED ALWAYS AS (meta) STORED;

CREATE INDEX IF NOT EXISTS idx_device_lifecycle_reference_table ON public.device_lifecycle(reference_table);
CREATE INDEX IF NOT EXISTS idx_device_lifecycle_event_type ON public.device_lifecycle(event_type);

-- device_health_scores
CREATE TABLE IF NOT EXISTS public.device_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text UNIQUE NOT NULL,
  device_name text,
  customer_name text,
  repair_count integer NOT NULL DEFAULT 0,
  ticket_count integer NOT NULL DEFAULT 0,
  complaint_count integer NOT NULL DEFAULT 0,
  spare_part_count integer NOT NULL DEFAULT 0,
  downtime_days numeric NOT NULL DEFAULT 0,
  warranty_cases integer NOT NULL DEFAULT 0,
  leasing_status text,
  warranty_status text,
  health_status text NOT NULL DEFAULT 'grün',
  health_score numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.device_health_scores TO authenticated;
GRANT ALL ON public.device_health_scores TO service_role;

ALTER TABLE public.device_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_health_read_authenticated"
ON public.device_health_scores FOR SELECT
TO authenticated
USING (true);

-- Recompute function
CREATE OR REPLACE FUNCTION public.recompute_device_health(_serial text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev text; v_cust text;
  v_rep int; v_tic int; v_compl int; v_parts int; v_warr int;
  v_leasing text; v_warranty text;
  v_status text; v_score numeric;
BEGIN
  IF _serial IS NULL OR length(trim(_serial)) = 0 THEN RETURN; END IF;

  SELECT device_name, customer_name
    INTO v_dev, v_cust
  FROM public.device_lifecycle
  WHERE serial_number = _serial
  ORDER BY event_date DESC NULLS LAST
  LIMIT 1;

  SELECT
    COUNT(*) FILTER (WHERE event_type = 'Reparatur'),
    COUNT(*) FILTER (WHERE event_type = 'Reklamation'),
    COUNT(*) FILTER (WHERE event_type = 'Reklamation'),
    COUNT(*) FILTER (WHERE event_type = 'Ersatzteil'),
    COUNT(*) FILTER (WHERE event_type = 'Garantie')
  INTO v_rep, v_tic, v_compl, v_parts, v_warr
  FROM public.device_lifecycle
  WHERE serial_number = _serial;

  v_leasing := CASE WHEN EXISTS (SELECT 1 FROM public.device_lifecycle WHERE serial_number = _serial AND event_type = 'Leasing') THEN 'aktiv' ELSE NULL END;
  v_warranty := CASE WHEN v_warr > 0 THEN 'Garantiefall' ELSE NULL END;

  v_score := v_rep * 2 + v_compl * 2 + v_parts + v_warr;
  IF v_rep + v_compl >= 4 OR v_parts >= 6 THEN v_status := 'rot';
  ELSIF v_rep + v_compl >= 2 OR v_parts >= 3 THEN v_status := 'gelb';
  ELSE v_status := 'grün';
  END IF;

  INSERT INTO public.device_health_scores(
    serial_number, device_name, customer_name,
    repair_count, ticket_count, complaint_count, spare_part_count,
    warranty_cases, leasing_status, warranty_status,
    health_status, health_score, updated_at
  ) VALUES (
    _serial, v_dev, v_cust, v_rep, v_tic, v_compl, v_parts, v_warr,
    v_leasing, v_warranty, v_status, v_score, now()
  )
  ON CONFLICT (serial_number) DO UPDATE SET
    device_name = EXCLUDED.device_name,
    customer_name = EXCLUDED.customer_name,
    repair_count = EXCLUDED.repair_count,
    ticket_count = EXCLUDED.ticket_count,
    complaint_count = EXCLUDED.complaint_count,
    spare_part_count = EXCLUDED.spare_part_count,
    warranty_cases = EXCLUDED.warranty_cases,
    leasing_status = EXCLUDED.leasing_status,
    warranty_status = EXCLUDED.warranty_status,
    health_status = EXCLUDED.health_status,
    health_score = EXCLUDED.health_score,
    updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.trg_dl_update_health()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_device_health(COALESCE(NEW.serial_number, OLD.serial_number));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_device_lifecycle_health ON public.device_lifecycle;
CREATE TRIGGER trg_device_lifecycle_health
AFTER INSERT OR UPDATE OR DELETE ON public.device_lifecycle
FOR EACH ROW EXECUTE FUNCTION public.trg_dl_update_health();

-- Backfill health for existing serials
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT serial_number FROM public.device_lifecycle WHERE serial_number IS NOT NULL LOOP
    PERFORM public.recompute_device_health(r.serial_number);
  END LOOP;
END $$;
