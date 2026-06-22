
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note text;

UPDATE public.offers SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at)
WHERE approval_status = 'pending' AND created_at < now() - interval '1 minute';
