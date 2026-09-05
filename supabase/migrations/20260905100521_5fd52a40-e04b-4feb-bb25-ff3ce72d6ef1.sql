ALTER TABLE public.ph_products
  ADD COLUMN IF NOT EXISTS config_colors text[] NOT NULL DEFAULT ARRAY['Blau / Gold','Schwarz / Gold','Weiß / Gold','Schwarz / Pink','Rot / Gold','Sonderfarbe RAL']::text[],
  ADD COLUMN IF NOT EXISTS config_powers text[] NOT NULL DEFAULT ARRAY['1600 W','2000 W','2400 W','3000 W']::text[],
  ADD COLUMN IF NOT EXISTS config_required boolean NOT NULL DEFAULT true;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS device_color text,
  ADD COLUMN IF NOT EXISTS ral_color_code text,
  ADD COLUMN IF NOT EXISTS laser_module_power text,
  ADD COLUMN IF NOT EXISTS ph_product_id uuid,
  ADD COLUMN IF NOT EXISTS ph_product_name text;