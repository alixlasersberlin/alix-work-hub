-- 1) Sequence für laufende Nummer
CREATE SEQUENCE IF NOT EXISTS public.production_order_seq START WITH 1 INCREMENT BY 1;

-- 2) Spalte hinzufügen
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS production_order_number text;

-- 3) Bestehende Datensätze chronologisch nachnummerieren
WITH numbered AS (
  SELECT id, order_number,
         ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.production_orders
  WHERE production_order_number IS NULL
)
UPDATE public.production_orders po
SET production_order_number = 'OR-' || LPAD(n.rn::text, 5, '0') || '-' || COALESCE(po.order_number, '')
FROM numbered n
WHERE po.id = n.id;

-- Sequence auf nächsten freien Wert setzen
SELECT setval(
  'public.production_order_seq',
  GREATEST(
    (SELECT COUNT(*) FROM public.production_orders WHERE production_order_number IS NOT NULL),
    1
  ),
  true
);

-- 4) Eindeutigkeit
CREATE UNIQUE INDEX IF NOT EXISTS production_orders_production_order_number_key
  ON public.production_orders (production_order_number);

-- 5) Trigger-Funktion: vor INSERT automatisch Nummer vergeben
CREATE OR REPLACE FUNCTION public.assign_production_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_seq bigint;
BEGIN
  IF NEW.production_order_number IS NULL OR length(trim(NEW.production_order_number)) = 0 THEN
    next_seq := nextval('public.production_order_seq');
    NEW.production_order_number :=
      'OR-' || LPAD(next_seq::text, 5, '0') || '-' || COALESCE(NEW.order_number, '');
  END IF;
  RETURN NEW;
END;
$$;

-- 6) Trigger anhängen
DROP TRIGGER IF EXISTS trg_assign_production_order_number ON public.production_orders;
CREATE TRIGGER trg_assign_production_order_number
BEFORE INSERT ON public.production_orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_production_order_number();
