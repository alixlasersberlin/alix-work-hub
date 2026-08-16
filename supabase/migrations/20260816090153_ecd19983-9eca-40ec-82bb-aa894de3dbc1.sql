CREATE TABLE public.ph_canary_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  alix_product_id text,
  channel_code text NOT NULL DEFAULT 'de',
  status text NOT NULL DEFAULT 'DRAFT',
  snapshot_at timestamptz,
  frozen_at timestamptz,
  master_hash text,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_canary_batches TO authenticated;
GRANT ALL ON public.ph_canary_batches TO service_role;
ALTER TABLE public.ph_canary_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_canary_batches_read" ON public.ph_canary_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "ph_canary_batches_write" ON public.ph_canary_batches FOR ALL TO authenticated
  USING (ph_can_edit()) WITH CHECK (ph_can_edit());

CREATE TABLE public.ph_canary_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.ph_canary_batches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  alix_product_id text,
  channel_code text NOT NULL DEFAULT 'de',
  field text NOT NULL,
  current_live_value text,
  value_state text NOT NULL DEFAULT 'VALUE',
  target_master_value text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'DE_LIVE',
  source_hash text,
  publish_id uuid,
  rollback_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ph_canary_snapshots TO authenticated;
GRANT ALL ON public.ph_canary_snapshots TO service_role;
ALTER TABLE public.ph_canary_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_canary_snapshots_read" ON public.ph_canary_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "ph_canary_snapshots_insert" ON public.ph_canary_snapshots FOR INSERT TO authenticated
  WITH CHECK (ph_can_edit());

CREATE OR REPLACE FUNCTION public.ph_canary_snapshot_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'ph_canary_snapshots ist unveraenderlich (WORM)';
END;
$$;
CREATE TRIGGER ph_canary_snapshots_worm
BEFORE UPDATE OR DELETE ON public.ph_canary_snapshots
FOR EACH ROW EXECUTE FUNCTION public.ph_canary_snapshot_immutable();

CREATE INDEX idx_ph_canary_snapshots_batch ON public.ph_canary_snapshots(batch_id);
CREATE INDEX idx_ph_canary_batches_product ON public.ph_canary_batches(product_id, status);

ALTER TABLE public.ph_publish_queue
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS expected_previous_value jsonb,
  ADD COLUMN IF NOT EXISTS verify_status text,
  ADD COLUMN IF NOT EXISTS rollback_publish_id uuid,
  ADD COLUMN IF NOT EXISTS rollback_order integer;

CREATE INDEX IF NOT EXISTS idx_ph_publish_queue_batch ON public.ph_publish_queue(batch_id);