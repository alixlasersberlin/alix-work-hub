ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_image_url text;
ALTER TABLE public.ph_products ADD COLUMN IF NOT EXISTS offer_image_url text;
UPDATE public.ph_products SET offer_image_url = hero_image_url WHERE offer_image_url IS NULL AND hero_image_url IS NOT NULL;