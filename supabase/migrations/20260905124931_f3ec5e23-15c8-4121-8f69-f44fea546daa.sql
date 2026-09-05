ALTER TABLE public.ph_products
  ADD COLUMN IF NOT EXISTS price_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_uvp numeric,
  ADD COLUMN IF NOT EXISTS vk_min_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS vk_min_value numeric,
  ADD COLUMN IF NOT EXISTS vk_max_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS vk_max_value numeric,
  ADD COLUMN IF NOT EXISTS promo_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_name text;