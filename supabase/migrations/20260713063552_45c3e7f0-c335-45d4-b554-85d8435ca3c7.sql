
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS last_edited_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.catalog_item_prices
  ADD COLUMN IF NOT EXISTS last_edited_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE OR REPLACE FUNCTION public.catalog_track_edit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Wenn approved_by neu gesetzt wird: Vier-Augen-Regel
    IF NEW.approved_by IS NOT NULL AND (OLD.approved_by IS NULL OR OLD.approved_by <> NEW.approved_by) THEN
      IF NEW.approved_by = COALESCE(NEW.last_edited_by, OLD.last_edited_by) THEN
        RAISE EXCEPTION 'Vier-Augen-Prinzip: Freigeber darf nicht letzter Bearbeiter sein';
      END IF;
      NEW.approved_at := now();
    ELSE
      -- normale Bearbeitung
      NEW.last_edited_by := auth.uid();
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.last_edited_by := COALESCE(NEW.last_edited_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_catalog_items_track_edit ON public.catalog_items;
CREATE TRIGGER trg_catalog_items_track_edit
BEFORE INSERT OR UPDATE ON public.catalog_items
FOR EACH ROW EXECUTE FUNCTION public.catalog_track_edit();

DROP TRIGGER IF EXISTS trg_catalog_prices_track_edit ON public.catalog_item_prices;
CREATE TRIGGER trg_catalog_prices_track_edit
BEFORE INSERT OR UPDATE ON public.catalog_item_prices
FOR EACH ROW EXECUTE FUNCTION public.catalog_track_edit();
