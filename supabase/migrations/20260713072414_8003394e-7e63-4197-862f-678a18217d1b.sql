-- 4-eyes Freigabe für catalog_item_prices
ALTER TABLE public.catalog_item_prices
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

CREATE INDEX IF NOT EXISTS idx_cat_prices_review ON public.catalog_item_prices(price_status, reviewed_at DESC);

-- Sicherheit: gleiche Person darf nicht Reviewer und Approver sein
CREATE OR REPLACE FUNCTION public.catalog_price_four_eyes_check()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.approved_by IS NOT NULL AND NEW.reviewed_by IS NOT NULL
     AND NEW.approved_by = NEW.reviewed_by THEN
    RAISE EXCEPTION '4-Augen-Prinzip verletzt: Freigeber muss von Prüfer verschieden sein';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cat_price_4eyes ON public.catalog_item_prices;
CREATE TRIGGER trg_cat_price_4eyes
BEFORE INSERT OR UPDATE ON public.catalog_item_prices
FOR EACH ROW EXECUTE FUNCTION public.catalog_price_four_eyes_check();