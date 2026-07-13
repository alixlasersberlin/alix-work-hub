
-- Phase 10: Automatische Änderungsprotokolle für Katalog-Kerntabellen
CREATE OR REPLACE FUNCTION public.catalog_log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type text := TG_ARGV[0];
  v_uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.catalog_change_log(entity_type, entity_id, action, new_value, performed_by, source)
    VALUES (v_entity_type, NEW.id, 'insert', to_jsonb(NEW), v_uid, 'ui');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      INSERT INTO public.catalog_change_log(entity_type, entity_id, action, old_value, new_value, performed_by, source)
      VALUES (v_entity_type, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), v_uid, 'ui');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.catalog_change_log(entity_type, entity_id, action, old_value, performed_by, source)
    VALUES (v_entity_type, OLD.id, 'delete', to_jsonb(OLD), v_uid, 'ui');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalog_items_changelog ON public.catalog_items;
CREATE TRIGGER trg_catalog_items_changelog
AFTER INSERT OR UPDATE OR DELETE ON public.catalog_items
FOR EACH ROW EXECUTE FUNCTION public.catalog_log_change('catalog_item');

DROP TRIGGER IF EXISTS trg_catalog_prices_changelog ON public.catalog_item_prices;
CREATE TRIGGER trg_catalog_prices_changelog
AFTER INSERT OR UPDATE OR DELETE ON public.catalog_item_prices
FOR EACH ROW EXECUTE FUNCTION public.catalog_log_change('catalog_item_price');

DROP TRIGGER IF EXISTS trg_catalog_descriptions_changelog ON public.catalog_item_descriptions;
CREATE TRIGGER trg_catalog_descriptions_changelog
AFTER INSERT OR UPDATE OR DELETE ON public.catalog_item_descriptions
FOR EACH ROW EXECUTE FUNCTION public.catalog_log_change('catalog_item_description');

DROP TRIGGER IF EXISTS trg_catalog_images_changelog ON public.catalog_item_images;
CREATE TRIGGER trg_catalog_images_changelog
AFTER INSERT OR UPDATE OR DELETE ON public.catalog_item_images
FOR EACH ROW EXECUTE FUNCTION public.catalog_log_change('catalog_item_image');

CREATE INDEX IF NOT EXISTS idx_catalog_change_log_entity ON public.catalog_change_log(entity_type, entity_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_change_log_performed_at ON public.catalog_change_log(performed_at DESC);
