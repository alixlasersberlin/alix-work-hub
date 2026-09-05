ALTER TABLE public.ph_products ADD COLUMN IF NOT EXISTS price_countries jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.ph_products
SET price_countries = jsonb_build_object('de', jsonb_strip_nulls(jsonb_build_object(
  'currency','EUR','vat_rate',19,'input_mode','net','public', coalesce(price_public,false),
  'uvp', price_uvp,'vk_min_mode', vk_min_mode,'vk_min_value', vk_min_value,
  'vk_max_mode', vk_max_mode,'vk_max_value', vk_max_value,
  'promo_active', coalesce(promo_active,false),'promo_name', promo_name)))
WHERE price_countries = '{}'::jsonb;