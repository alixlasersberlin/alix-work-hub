ALTER TABLE public.ph_canary_snapshots ADD COLUMN IF NOT EXISTS readback_value text, ADD COLUMN IF NOT EXISTS readback_at timestamptz;
ALTER TABLE public.ph_canary_batches ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.ph_publish_queue ADD COLUMN IF NOT EXISTS verified_at timestamptz;