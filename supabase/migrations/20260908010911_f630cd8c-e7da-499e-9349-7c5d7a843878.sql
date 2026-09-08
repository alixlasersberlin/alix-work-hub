ALTER TABLE public.ph_product_translations
  ADD COLUMN IF NOT EXISTS intended_use text,
  ADD COLUMN IF NOT EXISTS product_group_label text;

CREATE TABLE IF NOT EXISTS public.ph_translation_qa (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.ph_products(id) on delete cascade,
  locale text not null check (locale in ('de','en','es','ru','ar')),
  status text not null default 'warning' check (status in ('pass','warning','blocked')),
  score int not null default 0,
  issues jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (product_id, locale)
);

GRANT SELECT ON public.ph_translation_qa TO authenticated;
GRANT ALL ON public.ph_translation_qa TO service_role;
ALTER TABLE public.ph_translation_qa ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY ph_qa_read ON public.ph_translation_qa FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ph_qa_write ON public.ph_translation_qa FOR ALL TO authenticated
    USING (public.ph_can_edit()) WITH CHECK (public.ph_can_edit());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ph_qa_product ON public.ph_translation_qa(product_id);