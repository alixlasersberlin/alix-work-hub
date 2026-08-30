CREATE TABLE public.ch_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content_hash text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'approved',
  compliance_required boolean NOT NULL DEFAULT false,
  compliance_approved_by uuid,
  compliance_approved_at timestamptz,
  approved_by uuid,
  approved_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version)
);

CREATE TABLE public.ch_channel_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  channel text NOT NULL,
  published_version integer,
  published_at timestamptz,
  published_hash text,
  is_stale boolean NOT NULL DEFAULT true,
  last_error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, channel)
);

CREATE TABLE public.ch_render_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  channel text NOT NULL,
  content_hash text NOT NULL,
  rendered jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, channel)
);

GRANT SELECT, INSERT ON public.ch_releases TO authenticated;
GRANT ALL ON public.ch_releases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ch_channel_state TO authenticated;
GRANT ALL ON public.ch_channel_state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ch_render_cache TO authenticated;
GRANT ALL ON public.ch_render_cache TO service_role;

ALTER TABLE public.ch_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ch_channel_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ch_render_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY ch_releases_read ON public.ch_releases FOR SELECT TO authenticated USING (true);
CREATE POLICY ch_releases_insert ON public.ch_releases FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit());

CREATE POLICY ch_channel_state_read ON public.ch_channel_state FOR SELECT TO authenticated USING (true);
CREATE POLICY ch_channel_state_insert ON public.ch_channel_state FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit());
CREATE POLICY ch_channel_state_update ON public.ch_channel_state FOR UPDATE TO authenticated USING (public.ph_can_edit());
CREATE POLICY ch_channel_state_delete ON public.ch_channel_state FOR DELETE TO authenticated USING (public.has_role('Super Admin'::text));

CREATE POLICY ch_render_cache_read ON public.ch_render_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY ch_render_cache_insert ON public.ch_render_cache FOR INSERT TO authenticated WITH CHECK (public.ph_can_edit());
CREATE POLICY ch_render_cache_update ON public.ch_render_cache FOR UPDATE TO authenticated USING (public.ph_can_edit());
CREATE POLICY ch_render_cache_delete ON public.ch_render_cache FOR DELETE TO authenticated USING (public.has_role('Super Admin'::text));

CREATE OR REPLACE FUNCTION public.ch_block_release_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'ch_releases ist revisionssicher (WORM) und darf nicht geändert oder gelöscht werden';
END;
$$;

CREATE TRIGGER ch_releases_worm
BEFORE UPDATE OR DELETE ON public.ch_releases
FOR EACH ROW EXECUTE FUNCTION public.ch_block_release_mutation();

CREATE OR REPLACE FUNCTION public.ch_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ch_channel_state_touch BEFORE UPDATE ON public.ch_channel_state
FOR EACH ROW EXECUTE FUNCTION public.ch_touch_updated_at();
CREATE TRIGGER ch_render_cache_touch BEFORE UPDATE ON public.ch_render_cache
FOR EACH ROW EXECUTE FUNCTION public.ch_touch_updated_at();

CREATE INDEX idx_ch_releases_product ON public.ch_releases(product_id, version DESC);
CREATE INDEX idx_ch_channel_state_stale ON public.ch_channel_state(is_stale) WHERE is_stale;