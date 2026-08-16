CREATE TABLE public.ph_publish_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  channel_code text NOT NULL,
  field_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  status text NOT NULL DEFAULT 'draft',
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  published_at timestamptz,
  error_message text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ph_publish_queue TO authenticated;
GRANT ALL ON public.ph_publish_queue TO service_role;
ALTER TABLE public.ph_publish_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_queue_read" ON public.ph_publish_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "ph_queue_write" ON public.ph_publish_queue FOR ALL TO authenticated
  USING (public.ph_can_edit()) WITH CHECK (public.ph_can_edit());

CREATE TABLE public.ph_publish_rollbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES public.ph_publish_queue(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.ph_products(id) ON DELETE CASCADE,
  channel_code text NOT NULL,
  field_key text NOT NULL,
  previous_value jsonb,
  restored_value jsonb,
  action text NOT NULL DEFAULT 'snapshot',
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ph_publish_rollbacks TO authenticated;
GRANT ALL ON public.ph_publish_rollbacks TO service_role;
ALTER TABLE public.ph_publish_rollbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_rollback_read" ON public.ph_publish_rollbacks FOR SELECT TO authenticated USING (true);
CREATE POLICY "ph_rollback_insert" ON public.ph_publish_rollbacks FOR INSERT TO authenticated
  WITH CHECK (public.ph_can_edit());

CREATE TABLE public.ph_validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL DEFAULT 'B',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  reference_diff jsonb NOT NULL DEFAULT '[]'::jsonb,
  overrides jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ph_validation_runs TO authenticated;
GRANT ALL ON public.ph_validation_runs TO service_role;
ALTER TABLE public.ph_validation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_val_read" ON public.ph_validation_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "ph_val_insert" ON public.ph_validation_runs FOR INSERT TO authenticated
  WITH CHECK (public.ph_can_edit());
CREATE POLICY "ph_val_delete" ON public.ph_validation_runs FOR DELETE TO authenticated
  USING (public.has_role('Super Admin'::text));

CREATE INDEX idx_ph_queue_product ON public.ph_publish_queue(product_id);
CREATE INDEX idx_ph_queue_status ON public.ph_publish_queue(status);
CREATE TRIGGER trg_ph_queue_touch BEFORE UPDATE ON public.ph_publish_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();