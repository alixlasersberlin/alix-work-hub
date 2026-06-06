
-- Service Automation: additive columns and tables

-- 1. Tickets: classification + SLA columns
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS auto_category text,
  ADD COLUMN IF NOT EXISTS auto_priority text,
  ADD COLUMN IF NOT EXISTS suggested_technician_id uuid,
  ADD COLUMN IF NOT EXISTS sla_status text DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS sla_last_check timestamptz,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_notify_customer boolean DEFAULT false;

-- 2. Category rules
CREATE TABLE IF NOT EXISTS public.ticket_category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  keyword text NOT NULL,
  priority_override text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticket_category_rules TO authenticated;
GRANT ALL ON public.ticket_category_rules TO service_role;
ALTER TABLE public.ticket_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcr_read" ON public.ticket_category_rules FOR SELECT TO authenticated USING (public.can_access_tickets());
CREATE POLICY "tcr_admin_write" ON public.ticket_category_rules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Technician skills
CREATE TABLE IF NOT EXISTS public.technician_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);
GRANT SELECT ON public.technician_skills TO authenticated;
GRANT ALL ON public.technician_skills TO service_role;
ALTER TABLE public.technician_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ts_read" ON public.technician_skills FOR SELECT TO authenticated USING (public.can_access_tickets());
CREATE POLICY "ts_admin_write" ON public.technician_skills FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. Service communication log
CREATE TABLE IF NOT EXISTS public.service_communication_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid,
  repair_order_id uuid,
  event_type text NOT NULL,
  recipient_email text,
  status text NOT NULL DEFAULT 'sent',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.service_communication_log TO authenticated;
GRANT ALL ON public.service_communication_log TO service_role;
ALTER TABLE public.service_communication_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scl_read" ON public.service_communication_log FOR SELECT TO authenticated USING (public.can_access_tickets() OR public.can_access_repair());
CREATE POLICY "scl_insert" ON public.service_communication_log FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Classification function & trigger
CREATE OR REPLACE FUNCTION public.classify_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text text;
  v_cat text;
  v_high text[] := ARRAY['totalausfall','startet nicht','brandgeruch','überspannung','wasserschaden'];
  v_kw text;
  v_tech uuid;
BEGIN
  v_text := lower(coalesce(NEW.title,'') || ' ' || coalesce(NEW.description,''));

  -- Category from rules
  SELECT category INTO v_cat
    FROM public.ticket_category_rules
   WHERE active = true
     AND position(lower(keyword) in v_text) > 0
   ORDER BY length(keyword) DESC
   LIMIT 1;

  IF v_cat IS NULL THEN v_cat := 'Sonstiges'; END IF;
  NEW.auto_category := v_cat;

  -- High priority keywords
  FOREACH v_kw IN ARRAY v_high LOOP
    IF position(v_kw in v_text) > 0 THEN
      NEW.auto_priority := 'Hoch';
      EXIT;
    END IF;
  END LOOP;

  -- Technician suggestion
  SELECT user_id INTO v_tech
    FROM public.technician_skills
   WHERE active = true AND category = v_cat
   ORDER BY created_at ASC LIMIT 1;
  IF v_tech IS NOT NULL THEN
    NEW.suggested_technician_id := v_tech;
  END IF;

  NEW.classified_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classify_ticket ON public.tickets;
CREATE TRIGGER trg_classify_ticket
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.classify_ticket();

-- 6. Seed category rules (idempotent)
INSERT INTO public.ticket_category_rules (category, keyword) VALUES
  ('Software','software'),('Software','update'),('Software','firmware'),('Software','absturz'),
  ('Handstück','handstück'),('Handstück','handpiece'),('Handstück','tip'),
  ('Kühlung','kühlung'),('Kühlung','lüfter'),('Kühlung','überhitzung'),
  ('Netzteil','netzteil'),('Netzteil','power supply'),('Netzteil','stromversorgung'),
  ('Display','display'),('Display','bildschirm'),('Display','touchscreen'),
  ('Wasserstand','wasserstand'),('Wasserstand','wassertank'),('Wasserstand','water level'),
  ('Kalibrierung','kalibrierung'),('Kalibrierung','calibration'),
  ('Versandschaden','versandschaden'),('Versandschaden','transportschaden'),('Versandschaden','beschädigt geliefert'),
  ('Garantie','garantie'),('Garantie','gewährleistung'),('Garantie','warranty'),
  ('Leasing','leasing'),('Leasing','miete'),('Leasing','ratenzahlung'),
  ('Rechnung','rechnung'),('Rechnung','invoice'),('Rechnung','zahlung')
ON CONFLICT DO NOTHING;
