
-- Phase 5: Repair Quotes + Shipping + Report PDF + new role "Reparaturannahme"

-- 1) Role
INSERT INTO public.roles (name, description)
SELECT 'Reparaturannahme', 'Werkstatt- und Reparaturannahme-Mitarbeiter'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Reparaturannahme');

-- 2) Extend access helpers (additive – add Reparaturannahme role)
CREATE OR REPLACE FUNCTION public.can_access_repair()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Order')
    OR public.has_role('Technik')
    OR public.has_role('Finance')
    OR public.has_role('Tourenplanung')
    OR public.has_role('Reparaturannahme');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_repair()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin()
    OR public.has_role('Order')
    OR public.has_role('Technik')
    OR public.has_role('Reparaturannahme');
$$;

-- 3) Additive columns on repair_orders (shipping + report)
ALTER TABLE public.repair_orders
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS shipping_tracking_number text,
  ADD COLUMN IF NOT EXISTS shipping_tracking_url text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_note text,
  ADD COLUMN IF NOT EXISTS report_pdf_path text;

-- 4) Sequence for quote numbers
CREATE SEQUENCE IF NOT EXISTS public.repair_quote_seq START 1;

-- 5) Repair quotes tables
CREATE TABLE IF NOT EXISTS public.repair_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  quote_number text UNIQUE,
  status text NOT NULL DEFAULT 'Entwurf',
  labor_hours numeric DEFAULT 0,
  labor_rate numeric DEFAULT 0,
  labor_total numeric DEFAULT 0,
  parts_total numeric DEFAULT 0,
  shipping_total numeric DEFAULT 0,
  total_net numeric DEFAULT 0,
  total_gross numeric DEFAULT 0,
  vat_rate numeric DEFAULT 19,
  customer_note text,
  internal_note text,
  pdf_path text,
  approval_token uuid NOT NULL DEFAULT gen_random_uuid(),
  sent_at timestamptz,
  decided_at timestamptz,
  decided_by_email text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_quotes TO authenticated;
GRANT ALL ON public.repair_quotes TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.repair_quote_seq TO authenticated, service_role;

ALTER TABLE public.repair_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_quotes select" ON public.repair_quotes
  FOR SELECT TO authenticated USING (public.can_access_repair());
CREATE POLICY "repair_quotes insert" ON public.repair_quotes
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_repair() OR public.has_role('Finance'));
CREATE POLICY "repair_quotes update" ON public.repair_quotes
  FOR UPDATE TO authenticated USING (public.can_manage_repair() OR public.has_role('Finance'))
  WITH CHECK (public.can_manage_repair() OR public.has_role('Finance'));
CREATE POLICY "repair_quotes delete" ON public.repair_quotes
  FOR DELETE TO authenticated USING (public.has_role('Super Admin'));

CREATE TABLE IF NOT EXISTS public.repair_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.repair_quotes(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'part',  -- part | labor | shipping | other
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  line_total numeric DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_quote_items TO authenticated;
GRANT ALL ON public.repair_quote_items TO service_role;
ALTER TABLE public.repair_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_quote_items select" ON public.repair_quote_items
  FOR SELECT TO authenticated USING (public.can_access_repair());
CREATE POLICY "repair_quote_items modify" ON public.repair_quote_items
  FOR ALL TO authenticated
  USING (public.can_manage_repair() OR public.has_role('Finance'))
  WITH CHECK (public.can_manage_repair() OR public.has_role('Finance'));

CREATE TABLE IF NOT EXISTS public.repair_quote_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.repair_quotes(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user uuid,
  actor_email text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.repair_quote_history TO authenticated;
GRANT ALL ON public.repair_quote_history TO service_role;
ALTER TABLE public.repair_quote_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_quote_history select" ON public.repair_quote_history
  FOR SELECT TO authenticated USING (public.can_access_repair());
CREATE POLICY "repair_quote_history insert" ON public.repair_quote_history
  FOR INSERT TO authenticated WITH CHECK (public.can_access_repair());

-- 6) Quote-Number trigger
CREATE OR REPLACE FUNCTION public.assign_repair_quote_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE next_seq bigint;
BEGIN
  IF NEW.quote_number IS NULL OR length(trim(NEW.quote_number)) = 0 THEN
    next_seq := nextval('public.repair_quote_seq');
    NEW.quote_number := 'KV-' || to_char(now(),'YYYY') || '-' || lpad(next_seq::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_repair_quote_number ON public.repair_quotes;
CREATE TRIGGER trg_assign_repair_quote_number
  BEFORE INSERT ON public.repair_quotes
  FOR EACH ROW EXECUTE FUNCTION public.assign_repair_quote_number();

DROP TRIGGER IF EXISTS trg_repair_quotes_updated_at ON public.repair_quotes;
CREATE TRIGGER trg_repair_quotes_updated_at
  BEFORE UPDATE ON public.repair_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) History trigger for quote status changes
CREATE OR REPLACE FUNCTION public.log_repair_quote_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.repair_quote_history(quote_id, action, actor_user, meta)
    VALUES (NEW.id, 'created', auth.uid(), jsonb_build_object('status', NEW.status));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.repair_quote_history(quote_id, action, actor_user, meta)
    VALUES (NEW.id, 'status_change', auth.uid(),
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_repair_quote_change ON public.repair_quotes;
CREATE TRIGGER trg_log_repair_quote_change
  AFTER INSERT OR UPDATE ON public.repair_quotes
  FOR EACH ROW EXECUTE FUNCTION public.log_repair_quote_change();
