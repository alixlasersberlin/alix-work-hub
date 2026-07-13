
-- Trigger to log catalog price changes to catalog_change_log
CREATE OR REPLACE FUNCTION public.log_catalog_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new jsonb;
  v_old jsonb;
BEGIN
  v_new := jsonb_build_object(
    'uvp_net', NEW.uvp_net,
    'uvp_gross', NEW.uvp_gross,
    'standard_net', NEW.standard_net,
    'standard_gross', NEW.standard_gross,
    'promo_net', NEW.promo_net,
    'promo_gross', NEW.promo_gross,
    'tax_rate', NEW.tax_rate,
    'currency_code', NEW.currency_code,
    'price_status', NEW.price_status,
    'valid_from', NEW.valid_from,
    'valid_until', NEW.valid_until,
    'country_id', NEW.country_id,
    'branch_id', NEW.branch_id,
    'item_id', NEW.item_id
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.catalog_change_log(entity_type, entity_id, field_name, old_value, new_value, action, source, performed_by)
    VALUES ('price', NEW.id, 'snapshot', NULL, v_new, 'insert', 'trigger', auth.uid());
    RETURN NEW;
  END IF;

  v_old := jsonb_build_object(
    'uvp_net', OLD.uvp_net,
    'uvp_gross', OLD.uvp_gross,
    'standard_net', OLD.standard_net,
    'standard_gross', OLD.standard_gross,
    'promo_net', OLD.promo_net,
    'promo_gross', OLD.promo_gross,
    'tax_rate', OLD.tax_rate,
    'currency_code', OLD.currency_code,
    'price_status', OLD.price_status,
    'valid_from', OLD.valid_from,
    'valid_until', OLD.valid_until,
    'country_id', OLD.country_id,
    'branch_id', OLD.branch_id,
    'item_id', OLD.item_id
  );

  IF v_old IS DISTINCT FROM v_new THEN
    INSERT INTO public.catalog_change_log(entity_type, entity_id, field_name, old_value, new_value, action, source, performed_by)
    VALUES ('price', NEW.id, 'snapshot', v_old, v_new, 'update', 'trigger', auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_catalog_price_change ON public.catalog_item_prices;
CREATE TRIGGER trg_log_catalog_price_change
AFTER INSERT OR UPDATE ON public.catalog_item_prices
FOR EACH ROW EXECUTE FUNCTION public.log_catalog_price_change();

-- Backfill an initial baseline entry per existing price row (only if no history exists for it)
INSERT INTO public.catalog_change_log(entity_type, entity_id, field_name, old_value, new_value, action, source, performed_by, performed_at)
SELECT 'price', p.id, 'snapshot', NULL,
  jsonb_build_object(
    'uvp_net', p.uvp_net, 'uvp_gross', p.uvp_gross,
    'standard_net', p.standard_net, 'standard_gross', p.standard_gross,
    'promo_net', p.promo_net, 'promo_gross', p.promo_gross,
    'tax_rate', p.tax_rate, 'currency_code', p.currency_code,
    'price_status', p.price_status,
    'valid_from', p.valid_from, 'valid_until', p.valid_until,
    'country_id', p.country_id, 'branch_id', p.branch_id, 'item_id', p.item_id
  ),
  'backfill', 'system', NULL, COALESCE(p.updated_at, p.created_at, now())
FROM public.catalog_item_prices p
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_change_log l
  WHERE l.entity_type = 'price' AND l.entity_id = p.id
);
