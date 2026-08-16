
-- ============ PRODUCT HUB (additiv) ============
CREATE TABLE IF NOT EXISTS public.ph_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alix_product_id text UNIQUE,
  source_product_id text,
  name text NOT NULL,
  internal_name text,
  model text,
  sku text,
  slug text,
  status text NOT NULL DEFAULT 'draft',
  product_group text,
  categories text[] NOT NULL DEFAULT '{}',
  applications text[] NOT NULL DEFAULT '{}',
  short_description text,
  long_description text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  smart_ki jsonb NOT NULL DEFAULT '{}'::jsonb,
  tech_specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  wavelengths text,
  power text,
  fluence text,
  pulse_duration text,
  frequency text,
  spot_sizes text,
  cooling text,
  laser_class text,
  intended_use text,
  manufacturer text,
  production_site text,
  ce_status text,
  mdr_status text,
  iso_status text,
  standards text[] NOT NULL DEFAULT '{}',
  hero_image_url text,
  seo_title text,
  seo_description text,
  sort_order integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  protected boolean NOT NULL DEFAULT false,
  manual_override boolean NOT NULL DEFAULT false,
  active_de boolean NOT NULL DEFAULT false,
  active_com boolean NOT NULL DEFAULT false,
  active_at boolean NOT NULL DEFAULT false,
  active_usa boolean NOT NULL DEFAULT false,
  active_dubai boolean NOT NULL DEFAULT false,
  plm_device_id uuid REFERENCES public.plm_devices(id) ON DELETE SET NULL,
  catalog_item_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
CREATE INDEX IF NOT EXISTS idx_ph_products_slug ON public.ph_products(slug);
CREATE INDEX IF NOT EXISTS idx_ph_products_sku ON public.ph_products(sku);
CREATE INDEX IF NOT EXISTS idx_ph_products_status ON public.ph_products(status);

CREATE TABLE IF NOT EXISTS public.ph_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  base_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ph_product_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  channel_code text NOT NULL,
  status text NOT NULL DEFAULT 'not_published',
  publish_state text NOT NULL DEFAULT 'draft',
  hold boolean NOT NULL DEFAULT false,
  live_version text,
  live_url text,
  remote_id text,
  last_sync_at timestamptz,
  last_sync_status text,
  has_pending_changes boolean NOT NULL DEFAULT false,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  remote_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_title text,
  seo_description text,
  slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, channel_code)
);

CREATE TABLE IF NOT EXISTS public.ph_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  url text NOT NULL,
  storage_path text,
  kind text NOT NULL DEFAULT 'gallery',
  media_type text NOT NULL DEFAULT 'image',
  title text,
  alt_text text,
  channels text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_ph_media_product ON public.ph_media(product_id);

CREATE TABLE IF NOT EXISTS public.ph_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'datasheet',
  visibility text NOT NULL DEFAULT 'internal',
  language text DEFAULT 'de',
  version text,
  url text,
  storage_path text,
  file_size bigint,
  valid_until date,
  channels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_ph_documents_product ON public.ph_documents(product_id);

CREATE TABLE IF NOT EXISTS public.ph_field_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.ph_products(id) ON DELETE SET NULL,
  alix_product_id text,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  is_critical boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'alixwork',
  approval_status text NOT NULL DEFAULT 'applied',
  channel_code text,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ph_hist_product ON public.ph_field_history(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ph_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  channel_code text NOT NULL,
  field_name text NOT NULL,
  master_value text,
  channel_value text,
  severity text NOT NULL DEFAULT 'warning',
  resolution text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ph_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_code text,
  direction text NOT NULL DEFAULT 'import',
  operation text,
  product_id uuid,
  status text NOT NULL DEFAULT 'ok',
  message text,
  payload jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ph_sync_log_created ON public.ph_sync_log(created_at DESC);

CREATE TABLE IF NOT EXISTS public.ph_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ph_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ph_role)
);

CREATE TABLE IF NOT EXISTS public.ph_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_product_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_documents TO authenticated;
GRANT SELECT, INSERT ON public.ph_field_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_conflicts TO authenticated;
GRANT SELECT, INSERT ON public.ph_sync_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_settings TO authenticated;
GRANT ALL ON public.ph_products, public.ph_channels, public.ph_product_channels, public.ph_media,
  public.ph_documents, public.ph_field_history, public.ph_conflicts, public.ph_sync_log,
  public.ph_roles, public.ph_settings TO service_role;

-- RLS
ALTER TABLE public.ph_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_product_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_field_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ph_can_edit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('Super Admin') OR public.has_role('Admin')
      OR EXISTS (SELECT 1 FROM public.ph_roles r WHERE r.user_id = auth.uid()
                  AND r.ph_role IN ('Product Admin','Regulatory','Marketing','Admin'));
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ph_products','ph_channels','ph_product_channels','ph_media','ph_documents','ph_conflicts','ph_settings','ph_roles']
  LOOP
    EXECUTE format('CREATE POLICY ph_read ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY ph_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit())', t);
    EXECUTE format('CREATE POLICY ph_update ON public.%I FOR UPDATE TO authenticated USING (public.ph_can_edit()) WITH CHECK (public.ph_can_edit())', t);
    EXECUTE format('CREATE POLICY ph_delete ON public.%I FOR DELETE TO authenticated USING (public.has_role(''Super Admin''))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['ph_field_history','ph_sync_log']
  LOOP
    EXECUTE format('CREATE POLICY ph_read ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY ph_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
  END LOOP;
END $$;

-- updated_at trigger
CREATE TRIGGER trg_ph_products_upd BEFORE UPDATE ON public.ph_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ph_channels_upd BEFORE UPDATE ON public.ph_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ph_pc_upd BEFORE UPDATE ON public.ph_product_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ph_media_upd BEFORE UPDATE ON public.ph_media FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ph_documents_upd BEFORE UPDATE ON public.ph_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ph_conflicts_upd BEFORE UPDATE ON public.ph_conflicts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Änderungsprotokoll für alle Feldänderungen (kritische Felder markiert)
CREATE OR REPLACE FUNCTION public.ph_log_product_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  crit text[] := ARRAY['wavelengths','power','fluence','pulse_duration','frequency','spot_sizes','cooling','laser_class','intended_use','manufacturer','mdr_status','ce_status','iso_status','standards'];
  k text; ov text; nv text;
  oj jsonb := to_jsonb(OLD); nj jsonb := to_jsonb(NEW);
BEGIN
  FOR k IN SELECT jsonb_object_keys(nj) LOOP
    IF k IN ('updated_at','created_at') THEN CONTINUE; END IF;
    ov := oj ->> k; nv := nj ->> k;
    IF ov IS DISTINCT FROM nv THEN
      INSERT INTO public.ph_field_history(product_id, alix_product_id, field_name, old_value, new_value, is_critical, changed_by, source)
      VALUES (NEW.id, NEW.alix_product_id, k, ov, nv, k = ANY(crit), auth.uid(), 'alixwork');
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ph_products_history AFTER UPDATE ON public.ph_products
FOR EACH ROW EXECUTE FUNCTION public.ph_log_product_changes();

-- Seed Kanäle + Einstellungen
INSERT INTO public.ph_channels(code, name, base_url, sort_order, is_active) VALUES
  ('com','alix-lasers.com','https://alix-lasers.com',1,true),
  ('de','alix-lasers.de','https://alix-lasers.de',2,true),
  ('at','alix-lasers.at',NULL,3,false),
  ('usa','alix-lasers.us',NULL,4,false),
  ('dubai','alix-lasers.ae',NULL,5,false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ph_settings(key, value) VALUES
  ('migration_phase','{"phase":"A","com_de_sync_active":true,"alixwork_master":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
